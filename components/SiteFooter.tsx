import { DeleteDataButton } from "./DeleteDataButton";

export function SiteFooter() {
  return (
    <footer className="no-print">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-2 px-4 pb-8 pt-16 text-[13px] text-faint sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8">
        <p>Not a medical device. Best used with a therapist. In crisis, call or text 988.</p>
        <div className="flex items-center gap-4">
          <span>Banana Hacks 2026</span>
          <DeleteDataButton />
        </div>
      </div>
    </footer>
  );
}
