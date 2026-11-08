import * as React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

interface DangerConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will be deleted, in plain language (shown as a list) */
  consequences: string[];
  /** The user must type exactly this text before the button is enabled */
  confirmText: string;
  confirmLabel?: string;
  /** Extra controls (for example a checkbox) rendered above the typing field */
  children?: React.ReactNode;
  onConfirm: () => Promise<void>;
}

/** Irreversible-action dialog: the user has to type the target's name to continue. */
export function DangerConfirmDialog({
  open,
  onOpenChange,
  title,
  consequences,
  confirmText,
  confirmLabel = '永久刪除',
  children,
  onConfirm,
}: DangerConfirmDialogProps) {
  const [typed, setTyped] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  const matches = typed.trim() === confirmText.trim();

  const handleConfirm = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller shows the error toast; keep the dialog open so the user can retry or cancel
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            刪除後無法復原，登入帳號、資料與照片都會一起消失。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="list-inside list-disc space-y-1 rounded-md border border-border bg-secondary p-3 text-sm text-foreground">
          {consequences.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {children}

        <div className="space-y-2">
          <Label htmlFor="danger-confirm-input">
            請輸入「<span className="font-bold">{confirmText}</span>」確認
          </Label>
          <Input
            id="danger-confirm-input"
            autoComplete="off"
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleConfirm();
              }
            }}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={!matches || busy} onClick={() => void handleConfirm()}>
            {busy && <Spinner />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
