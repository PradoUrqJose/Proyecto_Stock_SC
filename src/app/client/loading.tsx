import { Loader2 } from "lucide-react";

export default function ClientLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-[#f8fafc] animate-pulse rounded" />
        <div className="h-4 w-64 bg-[#f8fafc] animate-pulse rounded mt-2" />
      </div>

      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-[60px] rounded-lg border border-[#dddddd] bg-white flex items-center justify-center"
          >
            <Loader2 className="h-5 w-5 animate-spin text-[#9297a0]" />
          </div>
        ))}
      </div>
    </div>
  );
}
