import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui";

export function ReceiveCard({ address }: { address: string }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    void import("qrcode")
      .then((mod) =>
        mod.toDataURL(address, {
          margin: 1,
          width: 280,
          color: { dark: "#141407", light: "#e4ff3a" },
        }),
      )
      .then((url) => {
        if (!cancel) setQr(url);
      })
      .catch(() => {
        if (!cancel) setQr(null);
      });
    return () => {
      cancel = true;
    };
  }, [address]);

  return (
    <div className="space-y-4">
      <p className="break-all font-mono text-sm">{address}</p>
      {qr ? (
        <img src={qr} alt="Receive QR code" className="w-full max-w-56 rounded-2xl" />
      ) : (
        <div className="grid h-56 max-w-56 place-items-center rounded-2xl bg-raised text-sm text-muted">
          Preparing QR
        </div>
      )}
      <Button
        type="button"
        variant="line"
        onClick={() => {
          void navigator.clipboard.writeText(address).then(
            () => toast.success("Address copied"),
            () => toast.error("Could not copy the address"),
          );
        }}
      >
        Copy address
      </Button>
      <p className="text-sm text-muted">
        Anyone with this address can send SOL or SPL tokens. Incoming transfers are public on-chain.
      </p>
    </div>
  );
}
