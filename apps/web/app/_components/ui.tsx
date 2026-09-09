"use client";

export function Back({ label, onClick }: { label?: string; onClick: () => void }) {
  return (
    <button type="button" className="back" onClick={onClick}>
      <span aria-hidden="true">‹</span> {label ?? "Back"}
    </button>
  );
}

export function Group({ children }: { children: JSX.Element | JSX.Element[] }) {
  return <div className="group">{children}</div>;
}

export function Cell({
  label,
  value,
  hint,
  danger,
  onClick,
}: {
  label: string;
  value?: string;
  hint?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className={danger ? "cell-label err" : "cell-label"}>{label}</span>
      {value ? <span className="cell-value muted">{value}</span> : null}
      {onClick ? <span className="chev" aria-hidden="true">›</span> : null}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className="cell tap" onClick={onClick}>
        {inner}
        {hint ? <span className="cell-hint muted">{hint}</span> : null}
      </button>
    );
  }
  return (
    <div className="cell">
      {inner}
      {hint ? <span className="cell-hint muted">{hint}</span> : null}
    </div>
  );
}

export function Switch({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="cell switch-row">
      <span>
        <span className="cell-label">{label}</span>
        {hint ? <span className="cell-hint muted">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={on ? "switch on" : "switch"}
        onClick={() => onChange(!on)}
      >
        <span />
      </button>
    </label>
  );
}

export function Confirm({
  title,
  body,
  confirm,
  danger,
  onYes,
  onNo,
}: {
  title: string;
  body: string;
  confirm: string;
  danger?: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="sheet">
        <h2 id="confirm-title">{title}</h2>
        <p className="muted">{body}</p>
        <div className="stack mt-4">
          <button type="button" className={danger ? "btn btn-danger" : "btn btn-lock"} onClick={onYes}>
            {confirm}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onNo}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
