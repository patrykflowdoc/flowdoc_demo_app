import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getAdminOrders } from "@/api/client";

const fmtPLN = (n: number) => n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

interface MonthData {
  month: string;
  year: number;
  orders: number;
  revenue: number;
}

const ReportsView = () => {
  const [monthlyData, setMonthlyData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      let data: Array<{ amount: number; createdAt?: string; status?: string }> = [];
      try {
        data = (await getAdminOrders()) as typeof data;
      } catch (e) {
        console.error(e);
        setLoading(false);
        return;
      }
      const filtered = data.filter((o) => o.status !== "Anulowane");
      const map: Record<string, { orders: number; revenue: number }> = {};
      filtered.forEach((o) => {
        const raw = o.createdAt;
        const d = new Date((raw as string) ?? "");
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!map[key]) map[key] = { orders: 0, revenue: 0 };
        map[key].orders++;
        map[key].revenue += Number(o.amount ?? 0);
      });

      const result: MonthData[] = Object.entries(map)
        .map(([key, val]) => {
          const [year, month] = key.split("-").map(Number);
          return { month: MONTH_NAMES[month], year, ...val };
        })
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year;
          return MONTH_NAMES.indexOf(a.month) - MONTH_NAMES.indexOf(b.month);
        });

      setMonthlyData(result);
      setLoading(false);
    };
    fetchData();
  }, []);

  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  const currentYearData = monthlyData.filter((d) => d.year === currentYear);
  const prevYearData = monthlyData.filter((d) => d.year === prevYear);

  const currentYearTotalOrders = currentYearData.reduce((s, d) => s + d.orders, 0);
  const currentYearTotalRevenue = currentYearData.reduce((s, d) => s + d.revenue, 0);
  const prevYearTotalOrders = prevYearData.reduce((s, d) => s + d.orders, 0);
  const prevYearTotalRevenue = prevYearData.reduce((s, d) => s + d.revenue, 0);

  const avgOrderCurrent = currentYearTotalOrders > 0 ? currentYearTotalRevenue / currentYearTotalOrders : 0;
  const avgOrderPrev = prevYearTotalOrders > 0 ? prevYearTotalRevenue / prevYearTotalOrders : 0;

  const maxRevenue = monthlyData.length > 0 ? Math.max(...monthlyData.map((d) => d.revenue)) : 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const renderYearTable = (data: MonthData[], year: number, totalOrders: number, totalRevenue: number, avgOrder: number, barOpacity: string) => (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Rok {year}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Brak danych za {year}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-foreground">Miesiąc</TableHead>
                <TableHead className="font-semibold text-foreground text-center">Zamówienia</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Przychód</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Śr. zamówienie</TableHead>
                <TableHead className="font-semibold text-foreground w-1/3"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.month + row.year}>
                  <TableCell className="font-medium">{row.month}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs">{row.orders}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">{fmtPLN(row.revenue)} zł</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.orders > 0 ? fmtPLN(row.revenue / row.orders) : "—"} zł
                  </TableCell>
                  <TableCell>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className={cn("h-2 rounded-full transition-all", barOpacity)}
                        style={{ width: `${(row.revenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="hover:bg-transparent border-t-2">
                <TableCell className="font-semibold">Suma</TableCell>
                <TableCell className="text-center font-semibold">{totalOrders}</TableCell>
                <TableCell className="text-right font-bold text-primary">{fmtPLN(totalRevenue)} zł</TableCell>
                <TableCell className="text-right font-semibold">{fmtPLN(avgOrder)} zł</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const comparableMonths = currentYearData.map((d) => d.month);
  const prevComparable = prevYearData.filter((d) => comparableMonths.includes(d.month));
  const prevRev = prevComparable.reduce((s, d) => s + d.revenue, 0);
  const change = prevRev > 0 ? ((currentYearTotalRevenue - prevRev) / prevRev) * 100 : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Raporty</h1>
        <p className="text-muted-foreground text-sm">Przegląd zamówień i przychodów</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Zamówienia {currentYear}</p>
            <p className="text-3xl font-bold text-foreground">{currentYearTotalOrders}</p>
            <p className="text-xs text-muted-foreground mt-1">vs {prevYearTotalOrders} w {prevYear}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Przychód {currentYear}</p>
            <p className="text-3xl font-bold text-primary">{fmtPLN(currentYearTotalRevenue)} zł</p>
            <p className="text-xs text-muted-foreground mt-1">vs {fmtPLN(prevYearTotalRevenue)} zł w {prevYear}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Śr. zamówienie {currentYear}</p>
            <p className="text-3xl font-bold text-foreground">{fmtPLN(avgOrderCurrent)} zł</p>
            <p className="text-xs text-muted-foreground mt-1">vs {fmtPLN(avgOrderPrev)} zł w {prevYear}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Zmiana r/r (przychód)</p>
            <p className={cn("text-3xl font-bold", change >= 0 ? "text-emerald-600" : "text-red-600")}>
              {prevRev > 0 ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">porównanie tych samych miesięcy</p>
          </CardContent>
        </Card>
      </div>

      {renderYearTable(currentYearData, currentYear, currentYearTotalOrders, currentYearTotalRevenue, avgOrderCurrent, "bg-primary")}
      {renderYearTable(prevYearData, prevYear, prevYearTotalOrders, prevYearTotalRevenue, avgOrderPrev, "bg-primary/60")}
    </div>
  );
};

export default ReportsView;
