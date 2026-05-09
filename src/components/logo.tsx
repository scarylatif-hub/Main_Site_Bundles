import Link from "next/link";

export function Logo() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 shrink-0 min-w-0"
      aria-label="SB Bundles Home"
    >
      {/* Signal bars icon — smaller on mobile */}
      <div className="flex items-end gap-[2px] justify-center shrink-0
                      w-8 h-8 sm:w-10 sm:h-10
                      rounded-lg sm:rounded-xl
                      bg-[#1D9E75]
                      px-2 pb-1.5 pt-1 sm:px-2.5 sm:pb-2 sm:pt-1.5">
        <div className="w-[4px] sm:w-[5px] rounded-sm bg-white/50"  style={{ height: "8px"  }} />
        <div className="w-[4px] sm:w-[5px] rounded-sm bg-white/75"  style={{ height: "13px" }} />
        <div className="w-[4px] sm:w-[5px] rounded-sm bg-white"     style={{ height: "18px" }} />
      </div>

      {/* Wordmark */}
      <div className="flex items-baseline gap-1 min-w-0">
        {/* "SB" pill — hidden on very small screens, shown sm+ */}
        <span
          className="hidden sm:inline text-xs font-bold tracking-wide px-1.5 py-0.5 rounded-md shrink-0"
          style={{ background: "#085041", color: "#E1F5EE" }}
        >
          SB
        </span>
        <span
          className="text-lg sm:text-2xl font-bold tracking-tight whitespace-nowrap"
          style={{ color: "#0F6E56" }}
        >
          SB Bundles
        </span>
      </div>
    </Link>
  );
}