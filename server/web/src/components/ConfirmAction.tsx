import { useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogPopup,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogClose,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
/** One confirmation, one mutation; synchronous guard also blocks rapid double clicks. */
export default function ConfirmAction({
  title,
  description,
  onConfirm,
}: {
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const running = useRef(false);
  async function confirm() {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!running.current) setOpen(next);
      }}
    >
      <AlertDialogTrigger render={<Button variant="destructive-outline" />}>
        Disconnect
      </AlertDialogTrigger>
      <AlertDialogPopup>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <AlertDialogClose
            disabled={busy}
            render={<Button variant="outline" />}
          >
            Cancel
          </AlertDialogClose>
          <Button
            variant="destructive"
            loading={busy}
            onClick={() => void confirm()}
          >
            Disconnect
          </Button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
