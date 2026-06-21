import { Loader2 } from "lucide-react";

export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-48 bg-[#f8fafc] animate-pulse rounded" />
        <div className="h-4 w-64 bg-[#f8fafc] animate-pulse rounded mt-2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[100px] rounded-lg border border-[#dddddd] bg-white flex items-center justify-center"
          >
            <Loader2 className="h-6 w-6 animate-spin text-[#9297a0]" />
          </div>
        ))}
      </div>

      <div className="h-[400px] rounded-lg border border-[#dddddd] bg-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#9297a0]" />
      </div>
    </div>
  );
}
