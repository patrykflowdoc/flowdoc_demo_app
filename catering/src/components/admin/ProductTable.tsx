import { Fragment } from "react/jsx-runtime";
import { ChevronRight } from "lucide-react";
import { TableCell, TableRow, Table, TableBody } from "../ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { cn } from "@/lib/utils";
import type { OrderItem } from "@/types/orders";

/** Skład dania — zwinięty domyślnie (jak szczegóły wariantów w edycji). */
export function OrderLineDishContents({
  contents,
  className,
}: {
  contents?: string[] | null;
  className?: string;
}) {
  const lines = (contents ?? []).map((c) => String(c).trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <Collapsible className={cn("mt-1", className)} defaultOpen={false}>
      <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-0.5 w-full text-left">
        <ChevronRight className="w-3.5 h-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
        Skład ({lines.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="pt-1 space-y-0.5 text-xs text-muted-foreground list-none pl-5">
          {lines.map((c, i) => (
            <li key={i} className="pl-2 border-l-2 border-primary/20">
              {c}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

export const ProductTable = ({ items }: { items: OrderItem[] }) => (
  <Table>
    <TableBody>
      {items.map((item) => (
        <Fragment key={String(item.id)}>
        <TableRow>
          <TableCell className="font-medium">
            <div>{item.name}</div>
            <OrderLineDishContents contents={item.dish?.contents} />
          </TableCell>
          <TableCell className="text-center">
            {item.quantity} {item.unit}
          </TableCell>
          <TableCell className="text-right text-muted-foreground">
            {item.pricePerUnit.toFixed(2)} zł
          </TableCell>
          <TableCell className="text-right font-semibold">{item.total.toFixed(2)} zł</TableCell>
        </TableRow>
        {(item.subItems ?? []).map((subItem) => {
          const subLineTotal =
            subItem.pricePerUnit != null
              ? subItem.pricePerUnit * subItem.quantity
              : null;
          return (
            <TableRow key={String(subItem.id)}>
              <TableCell className="font-medium pl-8 text-muted-foreground">
                <div>{subItem.name}</div>
                <OrderLineDishContents contents={subItem.dish?.contents} className="pl-2" />
              </TableCell>
              <TableCell className="text-center">
                {subItem.quantity} {subItem.unit}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {subItem.foodCostPerUnit != null
                  ? `${subItem.foodCostPerUnit.toFixed(2)} zł`
                  : "—"}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {subLineTotal != null
                  ? `${subLineTotal.toFixed(2)} zł`
                  : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </Fragment>
    ))}
    </TableBody>
  </Table>
);
