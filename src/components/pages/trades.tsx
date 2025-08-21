import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

export default function TradesPage() {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Zap className="h-5 w-5" />
          <span>Live Trades</span>
        </CardTitle>
        <CardDescription>
          Monitor real-time trading activity from your active agents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg">
          <div className="grid grid-cols-6 p-2 font-semibold border-b bg-slate-50 dark:bg-slate-800">
            <div>Agent</div>
            <div>Asset</div>
            <div>Side</div>
            <div>Price</div>
            <div>Quantity</div>
            <div>Timestamp</div>
          </div>
          <div className="divide-y">
            {[
              { agent: "Momentum Scalper", asset: "BTC_USDT", side: "BUY", price: "68,543.21", quantity: "0.05", time: "10:34:12 AM" },
              { agent: "Momentum Scalper", asset: "BTC_USDT", side: "SELL", price: "68,551.89", quantity: "0.05", time: "10:34:45 AM" },
              { agent: "Mean Reversion", asset: "ETH_USDT", side: "BUY", price: "3,412.56", quantity: "0.5", time: "10:35:02 AM" },
            ].map((trade, index) => (
              <div key={index} className="grid grid-cols-6 p-2 text-sm">
                <div>{trade.agent}</div>
                <div>{trade.asset}</div>
                <div>
                  <Badge variant={trade.side === "BUY" ? "default" : "destructive"} className={trade.side === "BUY" ? "bg-green-600" : "bg-red-600"}>
                    {trade.side}
                  </Badge>
                </div>
                <div>${trade.price}</div>
                <div>{trade.quantity}</div>
                <div>{trade.time}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
