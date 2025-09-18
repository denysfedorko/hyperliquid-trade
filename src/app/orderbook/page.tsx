"use client";

import Dropdown from "@/component/drop-down";
import Image from "next/image";
import { act, useEffect, useMemo, useRef, useState } from "react";

type L2Level = [number, number];

type RestBookResponse = {
	coin: string;
	time: number;
	levels: [
		{ px: string; sz: string; n: number }[],
		{ px: string; sz: string; n: number }[]
	];
};

type WsBookMessage =
	| {
			type: "l2Book";
			coin: string;
			levels?: RestBookResponse["levels"];
			bids?: L2Level[];
			asks?: L2Level[];
		}
	| any;


const DEFAULT_COIN = "ETH";
const WS_URL = "wss://api.hyperliquid.xyz/ws";
const INFO_URL = "https://api.hyperliquid.xyz/info";
const WINDOW_SIZE = 10;

function formatNumber(value: number, maxFraction = 2) {
	return value.toLocaleString(undefined, {
		minimumFractionDigits: 0,
		maximumFractionDigits: maxFraction,
	});
}

function calcMaxSize(levels: L2Level[]) {
	let max = 0;
	for (const [, size] of levels) {
		if (size > max) max = size;
	}
	return max || 1;
}

function normalizeBook(input: RestBookResponse | WsBookMessage): { bids: L2Level[]; asks: L2Level[] } | null {
	if ((input as RestBookResponse).levels) {
		const [bRaw, aRaw] = (input as RestBookResponse).levels;
		const bids: L2Level[] = bRaw.map((l) => [Number(l.px), Number(l.sz)]);
		const asks: L2Level[] = aRaw.map((l) => [Number(l.px), Number(l.sz)]);
		return { bids, asks };
	}

	if ((input as any).bids && (input as any).asks) {
		return { bids: (input as any).bids as L2Level[], asks: (input as any).asks as L2Level[] };
	}
	return null;
}

function Row({ price, size, total, max, side }: { price: number; size: number; total: number; max: number; side: "bid" | "ask" }) {
    const widthPct = Math.min(100, (size / max) * 100);
    return (
        <div className="relative h-7 text-xs font-mono">
            <div
                className={
                    "absolute inset-y-0 " + (side === "bid" ? "right-0 bg-[#1FA67D1A]" : "right-0 bg-[#ED70881A]")
                }
                style={{ width: `${widthPct}%` }}
            />
            <div className="relative z-10 grid grid-cols-[1fr_1fr_1fr] items-center px-2 h-full text-[12px]">
                <span className={(side === "bid" ? "text-[#1FA67D]" : "text-[#ED7088]") + " tabular-nums"}>{formatNumber(price, 2)}</span>
                <span className="text-foreground/80 tabular-nums text-right">{formatNumber(size, 4)}</span>
                <span className="text-foreground/90 tabular-nums text-right">{formatNumber(total, 4)}</span>
            </div>
        </div>
    );
}

export default function OrderBookPage() {
	const [coin, setCoin] = useState<string>(DEFAULT_COIN);
	const [bids, setBids] = useState<L2Level[]>([]);
	const [asks, setAsks] = useState<L2Level[]>([]);
	const [activeTab, setActiveTab] = useState<"orders" | "trades">("orders");
	const wsRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		let aborted = false;
		(async () => {
			try {
				const res = await fetch(INFO_URL, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ type: "l2Book", coin }),
				});
				if (!res.ok) throw new Error("Failed to fetch snapshot");
				const data = (await res.json()) as RestBookResponse;
				if (aborted) return;
				const norm = normalizeBook(data);
				if (norm) {
					setBids(norm.bids);
					setAsks(norm.asks);
				}
			} catch (_e) {
				// ignore
			}
		})();
		return () => {
			aborted = true;
		};
	}, [coin]);

	// Live updates via WS
	useEffect(() => {
		try {
			wsRef.current?.close();
		} catch {}
		const ws = new WebSocket(WS_URL);
		wsRef.current = ws;
		let opened = false;
		ws.onopen = () => {
			opened = true;
			ws.send(
				JSON.stringify({
					method: "subscribe",
					subscription: { type: "l2Book", coin },
				})
			);
		};
		ws.onmessage = (ev) => {
			try {
				const msg = JSON.parse(ev.data as string);
				if ((msg as any).channel === "l2Book") {
					const data = (msg as any).data as { coin?: string; levels?: { px: string; sz: string }[][] };
					if (data?.levels) {
						if (!data.coin || data.coin === coin) {
							const [bRaw, aRaw] = data.levels;
							const nextBids: L2Level[] = bRaw.map((l: any) => [Number(l.px), Number(l.sz)]);
							const nextAsks: L2Level[] = aRaw.map((l: any) => [Number(l.px), Number(l.sz)]);
							setBids(nextBids);
							setAsks(nextAsks);
						}
						return;
					}

					const norm = normalizeBook(msg as any);
					if (norm) {
						setBids(norm.bids);
						setAsks(norm.asks);
					}
				}
			} catch {}
		};
		ws.onerror = () => {
		};
		return () => {
			try {
				if (opened) {
					ws.close();
				}
			} catch {}
		};
	}, [coin]);

	const maxBid = useMemo(() => calcMaxSize(bids), [bids]);
	const maxAsk = useMemo(() => calcMaxSize(asks), [asks]);

	const bidsCum = useMemo(() => {
		let cum = 0;
		return bids.map(([p, s]) => {
			cum += s;
			return { p, s, t: cum };
		});
	}, [bids]);

	const asksCum = useMemo(() => {
		let cum = 0;
		return asks.map(([p, s]) => {
			cum += s;
			return { p, s, t: cum };
		});
	}, [asks]);

	return (
		<div className="min-h-screen w-full flex flex-col items-center px-4 py-6 gap-6 bg-[#1A1A1A]">
			<div className="w-full max-w-5xl flex items-center justify-between">
				<h1 className="text-xl font-semibold">Order Book</h1>
			</div>

			<div className="w-full max-w-[280px] grid grid-cols-1">
				<div className="flex border-b border-white/10 px-2">
					<button
						className={`flex-1 px-3 text-sm `}
						onClick={() => setActiveTab("orders")}
					>
						<div className={`py-2 relative ${activeTab === "orders" ? "" : "text-foreground/70"}`}>
							Order Book
							{activeTab === 'orders' && <div className="absolute bottom-0 left-[50%] -translate-x-[50%] w-6 h-[3px] bg-white"></div>}
						</div>
					</button>
					<button
						className={`flex-1 px-3 text-sm `}
						onClick={() => setActiveTab("trades")}
					>
						<div className={`py-2 relative ${activeTab === "trades" ? "" : "text-foreground/70"}`}>
							Trades
							{activeTab === 'trades' && <div className="absolute bottom-0 left-[50%] -translate-x-[50%] w-6 h-[3px] bg-white"></div>}
						</div>
					</button>
					<button>
						<Image
							src='/3dot.svg'
							width={6}
							height={6}
							alt="dot"
						/>
					</button>
				</div>

				{activeTab === "orders" && (
					<div className="grid grid-cols-1 gap-6">
						<div className="overflow-hidden">
							<div className="flex items-center justify-between p-2">
								<Dropdown 
									options={[]}
									selected="0.001"
								/>
								<Dropdown 
									options={["BTC", "ETH", "SOL", "LINK", "ARB"]}
									selected={coin}
									setSelected={setCoin}
								/>
								{/* <select
									className="h-9 rounded-md bg-white/5 border border-white/10 px-3 text-sm"
									value={coin}
									onChange={(e) => setCoin(e.target.value)}
								>
									{["BTC", "ETH", "SOL", "LINK", "ARB"].map((c) => (
										<option key={c} value={c}>
											{c}
										</option>
									))}
								</select> */}
							</div>
							<div className="grid grid-cols-[1fr_1fr_1fr] px-2 py-1 text-[12px] text-foreground/60 font-inter">
								<div>Price (USD)</div>
								<div className="text-right">Size ({coin})</div>
								<div className="text-right">Total ({coin})</div>
							</div>
							<div className="divide-y divide-white/5">
								{asksCum.slice(0, WINDOW_SIZE).map(({ p, s, t }) => (
									<Row key={`a-${p}`} price={p} size={s} total={t} max={maxAsk} side="ask" />
								))}
							</div>
							<div className="text-left p-2 text-[18px] text-[#1FA67D] font-medium">
								{(bidsCum.slice(0, WINDOW_SIZE).reduce((acc, { p}) => acc + p, 0)) / WINDOW_SIZE}
							</div>
							<div className="divide-y divide-white/5">
								{bidsCum.slice(0, WINDOW_SIZE).map(({ p, s, t }) => (
									<Row key={`b-${p}`} price={p} size={s} total={t} max={maxBid} side="bid" />
								))}
							</div>
						</div>
					</div>
				)}

				{activeTab === "trades" && (
					<div className="rounded-lg border border-white/10 p-4 text-sm text-foreground/80">
						No trades to display here yet.
					</div>
				)}
			</div>
		</div>
	);
}


