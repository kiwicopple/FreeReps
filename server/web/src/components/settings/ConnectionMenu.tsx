import { useRef, useState } from "react";
import { Button } from "../ui/button";
import {
  Menu,
  MenuTrigger,
  MenuPopup,
  MenuItem,
  MenuSeparator,
} from "../ui/menu";
import ConfirmAction from "../ConfirmAction";

/** Menu dismissal and confirmation have separate lifetimes and one return target. */
export default function ConnectionMenu({
  provider,
  description,
  onEdit,
  onDisconnect,
}: {
  provider: string;
  description: string;
  onEdit: () => void;
  onDisconnect: () => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <Menu>
        <MenuTrigger
          render={
            <Button
              id={`${provider.toLowerCase()}-manage`}
              ref={trigger}
              variant="outline"
            />
          }
          aria-label={`Manage ${provider}`}
        >
          Manage
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuItem onClick={onEdit}>Edit credentials</MenuItem>
          <MenuSeparator />
          <MenuItem variant="destructive" onClick={() => setConfirm(true)}>
            Disconnect
          </MenuItem>
        </MenuPopup>
      </Menu>
      <ConfirmAction
        title={`Disconnect ${provider}?`}
        description={description}
        onConfirm={onDisconnect}
        open={confirm}
        onOpenChange={setConfirm}
        finalFocus={trigger}
      />
    </>
  );
}
