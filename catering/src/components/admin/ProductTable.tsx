import { Fragment } from "react/jsx-runtime";
import { TableCell, TableRow, Table, TableBody } from "../ui/table";
import type { OrderItem } from "@/types/orders";

export const ProductTable = ({ items }: { items: OrderItem[] }) => (
  <Table>
    <TableBody>
      {items.map((item) => (
        <Fragment key={String(item.id)}>
        <TableRow>
          <TableCell className="font-medium">{item.name}</TableCell>
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
                {subItem.name}
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