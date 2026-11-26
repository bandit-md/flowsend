import { useState } from "react";
import { VersionedTransaction } from "@solana/web3.js";
import { toast } from "sonner";
import { Button, Field, SelectField } from "@/components/ui";
import { useWallet } from "@/components/wallet-provider";
import type { Portfolio } from "@/lib/chain/types";
import { prepareSendFn } from "@/lib/server/fns";
import { solLabel } from "@/lib/format";
import { useActivity } from "@/lib/stores";
import { signatureText } from "@/lib/wallet/detect";

export function SendPanel({ portfolio }: { portfolio: Portfolio }) {
  const { provider } = useWallet();
  const add = useActivity((state) => state.add);
  const [asset, setAsset] = useState("native");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<"edit" | "ready" | "signing">("edit");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof prepareSendFn>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = portfolio.tokens.find((token) => token.mint === asset);
  const symbol = asset === "native" ? "SOL" : selected?.symbol || "token";

  function dirty() {
    setPhase("edit");
    setPreview(null);
    setError(null);
  }

  async function previewFees() {
    setError(null);
    setPhase("edit");
    try {
      const next = await prepareSendFn({
        data: { from: portfolio.address, to: to.trim(), asset, amount: amount.trim(), symbol },
      });
      setPreview(next);
      setPhase("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview this transfer.");
    }
  }

  async function sign() {
    if (!preview || !provider) return;
    setPhase("signing");
    setError(null);
    try {
      const tx = VersionedTransaction.deserialize(base64ToBytes(preview.txBase64));
      const result = await provider.signAndSendTransaction(tx);
      const signature = await signatureText(result.signature);
      add({
        signature,
        at: Date.now(),
        asset: symbol,
        amount: amount.trim(),
        to: to.trim(),
        networkFeeLamports: preview.networkFeeLamports,
        ataRentLamports: preview.ataRentLamports,
      });
      toast.success("Transaction sent");
      setAmount("");
      setPhase("edit");
      setPreview(null);
    } catch (err) {
      setPhase("ready");
      setError(err instanceof Error ? err.message : "The wallet rejected the transaction.");
    }
  }

  return (
    <div className="space-y-4">
      <SelectField
        label="Asset"
        value={asset}
        onChange={(event) => {
          setAsset(event.target.value);
          dirty();
        }}
      >
        <option value="native">SOL · {portfolio.solUi}</option>
        {portfolio.tokens.map((token) => (
          <option key={token.mint} value={token.mint}>
            {token.symbol} · {token.uiAmount}
          </option>
        ))}
      </SelectField>
      <Field
        label="Recipient"
        value={to}
        placeholder="Solana address"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          setTo(event.target.value);
          dirty();
        }}
      />
      <Field
        label="Amount"
        inputMode="decimal"
        value={amount}
        placeholder="0.00"
        onChange={(event) => {
          setAmount(event.target.value);
          dirty();
        }}
        hint="Public transfer. Sender, recipient, amount, and fee are visible on Solana."
      />
      {preview && phase !== "edit" ? (
        <dl className="grid gap-2 rounded-2xl bg-bg p-4 text-sm">
          <Row label="Transfer" value={preview.summary} />
          <Row label="Network fee" value={solLabel(preview.networkFeeLamports)} />
          <Row
            label="Recipient account"
            value={preview.ataRentLamports ? `${solLabel(preview.ataRentLamports)} rent` : "Already exists"}
          />
          <Row label="Priority fee" value="Set in your wallet at approval" />
        </dl>
      ) : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="line" onClick={() => void previewFees()}>
          Preview fees
        </Button>
        <Button type="button" disabled={!preview || phase === "edit" || phase === "signing" || !provider} onClick={() => void sign()}>
          {phase === "signing" ? "Waiting for wallet" : "Sign and send"}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
