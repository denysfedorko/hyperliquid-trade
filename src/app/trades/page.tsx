"use client";

import { useEffect, useMemo, useState } from "react";

const INFO_URL = "https://api.hyperliquid.xyz/info";

async function fetchUserFills(address: string): Promise<any> {
	const res = await fetch(INFO_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ type: "userFills", user: address }),
	});
	if (!res.ok) throw new Error("Failed to fetch user fills");
    const data = await res.json();
    return data;
}

type Fill = {
  coin: string;
  dir: string;
  time: number; // timestamp in ms
  closedPnl: string;
  oid: number;
};

type PositionSummary = {
  coin: string;
  direction: "long" | "short";
  openTime: number;
  closeTime: number;
  durationMs: number;
  realizedPnlUsd: number;
};

function reconstructPositions(fills: Fill[]): PositionSummary[] {
  const positionsMap = new Map<
    number,
    {
      coin: string;
      direction: "long" | "short";
      openTime: number;
      closeTime: number;
      realizedPnl: number;
    }
  >();

  fills.forEach((fill) => {
		console.log(fill)
    const oid = fill.oid;
    const direction = fill.dir.includes("Long") ? "long" : "short";

    if (!positionsMap.has(oid)) {
      positionsMap.set(oid, {
        coin: fill.coin,
        direction,
        openTime: fill.time,
        closeTime: fill.time,
        realizedPnl: parseFloat(fill.closedPnl || "0"),
      });
    } else {
      const pos = positionsMap.get(oid)!;
      pos.openTime = Math.min(pos.openTime, fill.time);
      pos.closeTime = Math.max(pos.closeTime, fill.time);
      pos.realizedPnl += parseFloat(fill.closedPnl || "0");
    }
  });

  return Array.from(positionsMap.values()).map((pos) => ({
    coin: pos.coin,
    direction: pos.direction,
    openTime: pos.openTime,
    closeTime: pos.closeTime,
    durationMs: pos.closeTime - pos.openTime,
    realizedPnlUsd: parseFloat(pos.realizedPnl.toFixed(2)),
  }));
}

export default function TradesPage() {
  const [address, setAddress] = useState("");
  const [fills, setFills] = useState<Fill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const positions = useMemo(
    () => (fills ? reconstructPositions(fills) : []),
    [fills]
  );

  useEffect(() => {
    console.log("---------------->", positions);
  }, [positions]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFills(null);
    try {
      const raw = await fetchUserFills(address.trim());
      setFills(raw);
    } catch (err: any) {
      setError(err?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center px-4 py-6 gap-6">
      <h1 className="text-xl font-semibold">Completed Perp Trades</h1>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-3xl flex items-center gap-3"
      >
        <input
          type="text"
          placeholder="Enter HyperLiquid wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="flex-1 h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm"
          required
        />
        <button
          type="submit"
          className="h-10 px-4 rounded-md bg-foreground text-background text-sm"
          disabled={loading}
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </form>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {fills && (
        <div className="w-full max-w-3xl rounded-lg border border-white/10 overflow-hidden">
          <div className="grid grid-cols-5 text-xs uppercase tracking-wide text-foreground/70 px-3 py-2 bg-white/5 text-center">
            <div>Coin</div>
            <div>Direction</div>
            <div>Opened</div>
            <div>Duration</div>
            <div>Realized PnL (USD)</div>
          </div>
          <div className="divide-y divide-white/5">
            {positions.map((p, idx) => (
              <div key={idx} className="grid grid-cols-5 px-3 py-2 text-sm">
                <div className="text-center">{p.coin}</div>
                <div
                  className={
                     `text-center ${p.direction === "long" ? "text-green-400" : "text-red-400"}`
                  }
                >
                  {p.direction}
                </div>
                <div className="text-center">{new Date(p.openTime).toLocaleString()}</div>
                <div className="text-center">{Math.max(0, Math.round(p.durationMs / 1000))}s</div>
                <div
                  className={
                    `text-center ${p.realizedPnlUsd >= 0 ? "text-green-400" : "text-red-400"}`
                  }
                >
                  {p.realizedPnlUsd.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
