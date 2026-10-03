import { useEffect, useId, useState } from "react";
import { create } from "zustand";
import { randomUUID } from "~/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  DialogFooter,
} from "./ui/dialog";

export interface OrganizationNameRequestOptions {
  readonly title: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly submitLabel: string;
  readonly initialName?: string;
}

type NameRequest = OrganizationNameRequestOptions & {
  readonly id: string;
  readonly resolve: (name: string | null) => void;
};
const useNameRequest = create<{ request: NameRequest | null }>(() => ({ request: null }));

/** Resolves with the trimmed name, or null when cancelled or left unchanged. */
export function requestOrganizationName(
  options: OrganizationNameRequestOptions,
): Promise<string | null> {
  useNameRequest.getState().request?.resolve(null);
  return new Promise((resolve) => {
    useNameRequest.setState({ request: { ...options, id: randomUUID(), resolve } });
  });
}

function finish(name: string | null) {
  const request = useNameRequest.getState().request;
  useNameRequest.setState({ request: null });
  request?.resolve(name);
}

export function OrganizationNameDialogHost() {
  const request = useNameRequest((state) => state.request);
  useEffect(() => () => finish(null), []);
  return request ? <OrganizationNameDialog key={request.id} request={request} /> : null;
}

function OrganizationNameDialog({ request }: { request: NameRequest }) {
  const id = useId();
  const initialName = request.initialName ?? "";
  const [name, setName] = useState(initialName);
  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && trimmedName !== initialName.trim();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) finish(null);
      }}
    >
      <DialogPopup className="sm:max-w-sm">
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) finish(trimmedName);
          }}
        >
          <DialogHeader>
            <DialogTitle>{request.title}</DialogTitle>
            {request.description ? (
              <DialogDescription>{request.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogPanel>
            <div className="flex flex-col gap-2">
              <Label htmlFor={id}>Name</Label>
              <Input
                id={id}
                autoFocus
                required
                autoComplete="off"
                placeholder={request.placeholder}
                value={name}
                onChange={(event) => setName(event.target.value)}
                onFocus={(event) => event.target.select()}
              />
            </div>
          </DialogPanel>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => finish(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {request.submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
