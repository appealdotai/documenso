import { cn } from '@documenso/ui/lib/utils';
import { Label } from '@documenso/ui/primitives/label';
import { Switch } from '@documenso/ui/primitives/switch';
import type { LucideIcon } from 'lucide-react';

type SidebarRowProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  destructive?: boolean;
};

export function SidebarRow({ icon: Icon, destructive, className, children, ...props }: SidebarRowProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-[38px] w-full items-center gap-3 rounded-md px-2 text-left text-sm',
        'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:cursor-not-allowed disabled:opacity-60',
        destructive && 'text-destructive',
        className,
      )}
      {...props}
    >
      <Icon
        className={cn('h-[18px] w-5 shrink-0', destructive ? 'text-destructive' : 'text-muted-foreground')}
        aria-hidden
      />
      {children}
    </button>
  );
}

export function SidebarSectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('mt-4 mb-1 px-2 font-medium text-muted-foreground text-xs', className)}>{children}</p>;
}

type ToggleRowProps = {
  id: string;
  icon: LucideIcon;
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

export function SidebarToggleRow({
  id,
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  className,
}: ToggleRowProps) {
  return (
    <div className={cn('px-2 py-1.5', className)}>
      <div className="flex items-center gap-3">
        <Icon className="h-[18px] w-5 shrink-0 text-muted-foreground" aria-hidden />
        <Label htmlFor={id} className="flex-1 cursor-pointer font-normal text-sm">
          {label}
        </Label>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      </div>
      {description && <p className="mt-0.5 ml-8 text-muted-foreground text-xs">{description}</p>}
    </div>
  );
}

export type SaveState =
  | { kind: 'saving' }
  | { kind: 'saved'; at: Date }
  | { kind: 'dirty' }
  | { kind: 'idle' }
  | { kind: 'error' };

export function saveStatusText(autoSave: boolean, s: SaveState, now = new Date()): string {
  if (s.kind === 'saving') {
    return 'Saving...';
  }
  if (s.kind === 'error') {
    return "Couldn't save";
  }
  if (s.kind === 'saved') {
    const mins = Math.floor((now.getTime() - s.at.getTime()) / 60000);
    return mins < 1 ? 'Saved just now' : `Saved ${mins} min ago`;
  }
  if (!autoSave) {
    return s.kind === 'dirty' ? 'Unsaved changes' : 'Auto-save is off';
  }
  return 'Saved just now';
}
