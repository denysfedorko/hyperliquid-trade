"use client";

import { useMemo, useState } from "react";

const INFO_URL = "https://api.hyperliquid.xyz/info";

type Fill = {
	coin: string;
	side: "B" | "S"; // buy/long or sell/short
	sz: number;
	px: number;
	time: number; // ms
	cloid?: string;
};

type PositionLifecycle = {
	coin: string;
	direction: "long" | "short";
	openTime: number;
	closeTime: number;
	durationMs: number;
	realizedPnlUsd: number;
};

async function fetchUserFills(address: string): Promise<Fill[]> {
	const res = await fetch(INFO_URL, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ type: "userFills", user: address }),
	});
	if (!res.ok) throw new Error("Failed to fetch user fills");
	const data = await res.json();
	return (data?.fills || []) as Fill[];
}

function reconstructPositions(fills: Fill[]): PositionLifecycle[] {
	// Group by coin and direction using running position size
	const byCoin: Record<string, Fill[]> = {};
	fills.forEach((f) => {
		(byCoin[f.coin] ||= []).push(f);
	});
	const results: PositionLifecycle[] = [];
	for (const coin of Object.keys(byCoin)) {
		const coinFills = byCoin[coin].sort((a, b) => a.time - b.time);
		let positionSide: "long" | "short" | null = null;
		let positionSize = 0; // positive for long, negative for short
		let openTime = 0;
		let realizedPnl = 0;
		let avgEntryPx = 0;

		const commitIfClosed = (closeTime: number) => {
			if (positionSide && positionSize === 0 && openTime) {
				results.push({
					coin,
					direction: positionSide,
					openTime,
					closeTime,
					durationMs: Math.max(0, closeTime - openTime),
					realizedPnlUsd: realizedPnl,
				});
				positionSide = null;
				openTime = 0;
				realizedPnl = 0;
				avgEntryPx = 0;
			}
		};

		for (const f of coinFills) {
			const signedSz = f.side === "B" ? f.sz : -f.sz;
			if (positionSize === 0) {
				positionSize = signedSz;
				positionSide = positionSize > 0 ? "long" : "short";
				openTime = f.time;
				avgEntryPx = f.px;
				continue;
			}
			// If same direction, adjust average entry
			if ((positionSize > 0 && signedSz > 0) || (positionSize < 0 && signedSz < 0)) {
				const totalSz = Math.abs(positionSize) + Math.abs(signedSz);
				avgEntryPx = (avgEntryPx * Math.abs(positionSize) + f.px * Math.abs(signedSz)) / totalSz;
				positionSize += signedSz;
				continue;
			}
			// Opposite direction reduces/closes; compute realized pnl on closed size
			const reduceSz = Math.min(Math.abs(positionSize), Math.abs(signedSz));
			const pnlPerUnit = (f.px - avgEntryPx) * (positionSize > 0 ? 1 : -1);
			realizedPnl += pnlPerUnit * reduceSz;
			positionSize += signedSz;
			if (positionSize === 0) {
				commitIfClosed(f.time);
			}
		}
		// ignore still-open positions
	}
	return results.sort((a, b) => b.closeTime - a.closeTime);
}

export default function TradesPage() {
	const [address, setAddress] = useState("");
	const [fills, setFills] = useState<Fill[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const positions = useMemo(() => (fills ? reconstructPositions(fills) : []), [fills]);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setFills(null);
		try {
			const list = await fetchUserFills(address.trim());
			setFills(list);
		} catch (err: any) {
			setError(err?.message || "Failed to load");
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="min-h-screen w-full flex flex-col items-center px-4 py-6 gap-6">
			<h1 className="text-xl font-semibold">Completed Perp Trades</h1>
			<form onSubmit={onSubmit} className="w-full max-w-3xl flex items-center gap-3">
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
					<div className="grid grid-cols-5 text-xs uppercase tracking-wide text-foreground/70 px-3 py-2 bg-white/5">
						<div>Coin</div>
						<div>Direction</div>
						<div>Opened</div>
						<div>Duration</div>
						<div>Realized PnL (USD)</div>
					</div>
					<div className="divide-y divide-white/5">
						{positions.map((p, idx) => (
							<div key={idx} className="grid grid-cols-5 px-3 py-2 text-sm">
								<div>{p.coin}</div>
								<div className={p.direction === "long" ? "text-green-400" : "text-red-400"}>{p.direction}</div>
								<div>{new Date(p.openTime).toLocaleString()}</div>
								<div>{Math.max(0, Math.round(p.durationMs / 1000))}s</div>
								<div className={p.realizedPnlUsd >= 0 ? "text-green-400" : "text-red-400"}>
									{p.realizedPnlUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}


