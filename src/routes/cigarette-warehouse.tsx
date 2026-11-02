import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Boxes,
  CalendarDays,
  Cigarette,
  Clock3,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { DATE_AR, EGP, NUM, todayISO } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/cigarette-warehouse")({
  component: CigaretteWarehousePage,
});

type Item = Database["public"]["Tables"]["cig_items"]["Row"];
type Transfer = Database["public"]["Tables"]["cig_transfers"]["Row"];
type Purchase = Database["public"]["Tables"]["cig_purchases"]["Row"];
type Settlement = Database["public"]["Tables"]["cig_settlements"]["Row"];
type SupplierPurchase = {
  id: string;
  item_name: string;
  quantity: number;
  wholesale_price: number;
  purchase_date: string;
};

type WarehouseData = {
  settings: Database["public"]["Tables"]["cig_settings"]["Row"] | null;
  items: Item[];
  transfers: Transfer[];
  purchases: Purchase[];
  supplierPurchases: SupplierPurchase[];
  settlements: Settlement[];
  returnedBalance: number;
};

type DialogState =
  | { kind: "item"; item?: Item }
  | { kind: "transfer"; transfer?: Transfer }
  | { kind: "purchase"; purchase?: Purchase }
  | { kind: "settlement" }
  | null;

type WarehouseForm = {
  itemId: string;
  name: string;
  quantity: string;
  price: string;
  date: string;
  note: string;
};

const emptyForm = (): WarehouseForm => ({
  itemId: "",
  name: "",
  quantity: "",
  price: "",
  date: todayISO(),
  note: "",
});

const normalizeItemName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar");

async function loadWarehouse(): Promise<WarehouseData> {
  const [
    settingsResult,
    itemsResult,
    transfersResult,
    purchasesResult,
    supplierPurchasesResult,
    productsResult,
    settlementsResult,
  ] = await Promise.all([
    supabase.from("cig_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("cig_items").select("*").order("name"),
    supabase.from("cig_transfers").select("*").order("transfer_date", { ascending: false }),
    supabase.from("cig_purchases").select("*").order("purchase_date", { ascending: false }),
    supabase
      .from("purchases")
      .select("id, product_id, quantity, wholesale_price, purchase_date")
      .eq("supplier", "الونش🏡")
      .order("purchase_date", { ascending: false }),
    supabase.from("products").select("id, name"),
    supabase.from("cig_settlements").select("*").order("settlement_date", { ascending: false }),
  ]);

  const error = [
    settingsResult.error,
    itemsResult.error,
    transfersResult.error,
    purchasesResult.error,
    supplierPurchasesResult.error,
    productsResult.error,
    settlementsResult.error,
  ].find(Boolean);
  if (error) throw error;

  const productNames = new Map(
    (productsResult.data ?? []).map((product) => [product.id, product.name]),
  );
  const transfers = transfersResult.data ?? [];
  const purchases = purchasesResult.data ?? [];
  const supplierPurchases = (supplierPurchasesResult.data ?? []).map((purchase) => ({
    id: purchase.id,
    item_name: productNames.get(purchase.product_id) ?? "صنف غير معروف",
    quantity: Number(purchase.quantity),
    wholesale_price: Number(purchase.wholesale_price),
    purchase_date: purchase.purchase_date,
  }));
  const settlements = settlementsResult.data ?? [];
  const returnedBalance =
    transfers.reduce(
      (sum, transfer) => sum + Number(transfer.quantity) * Number(transfer.wholesale_price),
      0,
    ) +
    supplierPurchases.reduce(
      (sum, purchase) => sum + purchase.quantity * purchase.wholesale_price,
      0,
    ) -
    purchases.reduce(
      (sum, purchase) => sum + Number(purchase.quantity) * Number(purchase.wholesale_price),
      0,
    ) -
    settlements.reduce((sum, settlement) => sum + Number(settlement.amount), 0);

  return {
    settings: settingsResult.data,
    items: itemsResult.data ?? [],
    transfers,
    purchases,
    supplierPurchases,
    settlements,
    returnedBalance,
  };
}

function SectionCard({
  title,
  icon: Icon,
  description,
  action,
  children,
}: {
  title: string;
  icon: typeof Boxes;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyRows({ columns, message }: { columns: number; message: string }) {
  return (
    <tr>
      <td colSpan={columns} className="px-4 py-10 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  );
}

function CigaretteWarehousePage() {
  const qc = useQueryClient();
  const warehouseQ = useQuery({
    queryKey: ["cigarette-warehouse"],
    queryFn: loadWarehouse,
  });
  const data = warehouseQ.data;
  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const transfers = useMemo(() => data?.transfers ?? [], [data?.transfers]);
  const purchases = useMemo(() => data?.purchases ?? [], [data?.purchases]);
  const supplierPurchases = useMemo(() => data?.supplierPurchases ?? [], [data?.supplierPurchases]);
  const settlements = useMemo(() => data?.settlements ?? [], [data?.settlements]);
  const returnedBalance = data?.returnedBalance ?? 0;
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const purchaseAvailableBalance =
    returnedBalance +
    (dialog?.kind === "purchase" && dialog.purchase
      ? Number(dialog.purchase.quantity) * Number(dialog.purchase.wholesale_price)
      : 0);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const mutationLock = useRef(false);
  const needle = search.trim().toLocaleLowerCase("ar");

  const refresh = () => qc.invalidateQueries({ queryKey: ["cigarette-warehouse"] });
  const closeDialog = () => {
    setDialog(null);
    setForm(emptyForm());
  };
  const openDialog = (next: DialogState) => {
    setDialog(next);
    const initial = emptyForm();
    if (next?.kind === "item" && next.item) {
      initial.name = next.item.name;
      initial.quantity = String(next.item.quantity);
      initial.price = String(next.item.wholesale_price);
    } else if (next?.kind === "transfer" && next.transfer) {
      initial.itemId = next.transfer.item_id;
      initial.quantity = String(next.transfer.quantity);
      initial.date = next.transfer.transfer_date;
    } else if (next?.kind === "purchase" && next.purchase) {
      initial.itemId = next.purchase.item_id;
      initial.quantity = String(next.purchase.quantity);
      initial.price = String(next.purchase.wholesale_price);
      initial.date = next.purchase.purchase_date;
    }
    setForm(initial);
  };
  const finishMutation = () => {
    mutationLock.current = false;
  };

  const itemMutation = useMutation({
    mutationFn: async (input: { id?: string; name: string; quantity: number; price: number }) => {
      const result = input.id
        ? await supabase.rpc("cig_update_item", {
            p_item_id: input.id,
            p_name: input.name,
            p_quantity: input.quantity,
            p_wholesale_price: input.price,
          })
        : await supabase.rpc("cig_add_item", {
            p_name: input.name,
            p_quantity: input.quantity,
            p_wholesale_price: input.price,
          });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success("تم حفظ بيانات الصنف");
      closeDialog();
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: finishMutation,
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cig_delete_item", { p_item_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الصنف");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: finishMutation,
  });

  const transferMutation = useMutation({
    mutationFn: async (input: { id?: string; itemId: string; quantity: number; date: string }) => {
      const result = input.id
        ? await supabase.rpc("cig_update_transfer", {
            p_id: input.id,
            p_quantity: input.quantity,
            p_transfer_date: input.date,
          })
        : await supabase.rpc("cig_transfer", {
            p_item_id: input.itemId,
            p_quantity: input.quantity,
            p_transfer_date: input.date,
          });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success(
        dialog?.kind === "transfer" && dialog.transfer ? "تم تعديل النقل" : "تم نقل البضاعة للمحل",
      );
      closeDialog();
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: finishMutation,
  });

  const deleteTransferMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cig_delete_transfer", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف عملية النقل");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: finishMutation,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (input: {
      id?: string;
      itemId: string;
      name: string;
      quantity: number;
      price: number;
      date: string;
    }) => {
      const result = input.id
        ? await supabase.rpc("cig_update_purchase", {
            p_id: input.id,
            p_quantity: input.quantity,
            p_wholesale_price: input.price,
            p_purchase_date: input.date,
          })
        : await supabase.rpc("cig_purchase", {
            p_item_id: input.itemId || null,
            p_name: input.name,
            p_quantity: input.quantity,
            p_wholesale_price: input.price,
            p_purchase_date: input.date,
          });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      toast.success(
        dialog?.kind === "purchase" && dialog.purchase
          ? "تم تعديل المشتريات"
          : "تم تسجيل المشتريات",
      );
      closeDialog();
      refresh();
    },
    onError: (error: Error) => {
      if (error.message.includes("رصيد فلوس مردودة غير كافٍ") && returnedBalance > 0) {
        toast.error(
          `الواجهة تحسب رصيدًا قدره ${EGP(returnedBalance)}، لكن قاعدة البيانات تُرجع رصيدًا مختلفًا. طبّق ترحيل 20261102154000_cigarette_returned_balance.sql ثم أعد المحاولة.`,
        );
        return;
      }
      toast.error(error.message);
    },
    onSettled: finishMutation,
  });

  const deletePurchaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("cig_delete_purchase", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف سجل الشراء");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: finishMutation,
  });

  const settlementMutation = useMutation({
    mutationFn: async (input: { id?: string; amount?: number; date?: string; note?: string }) => {
      const result = input.id
        ? await supabase.rpc("cig_delete_settlement", { p_id: input.id })
        : await supabase.rpc("cig_add_settlement", {
            p_amount: input.amount ?? 0,
            p_note: input.note ?? "",
            p_settlement_date: input.date ?? todayISO(),
          });
      if (result.error) throw result.error;
    },
    onSuccess: (_, input) => {
      toast.success(input.id ? "تم حذف التسوية" : "تم تسجيل التسوية");
      closeDialog();
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: finishMutation,
  });

  const remainingItems = useMemo(() => {
    const purchasedByItem = new Map<string, { quantity: number; value: number }>();
    for (const purchase of purchases) {
      const current = purchasedByItem.get(purchase.item_id) ?? { quantity: 0, value: 0 };
      current.quantity += Number(purchase.quantity);
      current.value += Number(purchase.quantity) * Number(purchase.wholesale_price);
      purchasedByItem.set(purchase.item_id, current);
    }
    const movedToShopByItem = new Map<string, number>();
    for (const transfer of transfers) {
      movedToShopByItem.set(
        transfer.item_id,
        (movedToShopByItem.get(transfer.item_id) ?? 0) + Number(transfer.quantity),
      );
    }
    const itemIdByName = new Map(items.map((item) => [normalizeItemName(item.name), item.id]));
    for (const purchase of supplierPurchases) {
      const itemId = itemIdByName.get(normalizeItemName(purchase.item_name));
      if (!itemId) continue;
      movedToShopByItem.set(itemId, (movedToShopByItem.get(itemId) ?? 0) + purchase.quantity);
    }
    return items.map((item) => {
      const purchased = purchasedByItem.get(item.id) ?? { quantity: 0, value: 0 };
      const originalStockValue = Number(item.quantity) * Number(item.wholesale_price);
      const stockQuantity = Number(item.quantity) + purchased.quantity;
      const stockValue = originalStockValue + purchased.value;
      const stockUnitPrice =
        stockQuantity > 0 ? stockValue / stockQuantity : Number(item.wholesale_price);
      const quantity = stockQuantity - (movedToShopByItem.get(item.id) ?? 0);
      const value = quantity * stockUnitPrice;
      return {
        ...item,
        stockQuantity,
        stockUnitPrice,
        stockValue,
        remainingQuantity: quantity,
        remainingUnitPrice: stockUnitPrice,
        value,
      };
    });
  }, [items, purchases, supplierPurchases, transfers]);
  const warehouseStockValue = remainingItems.reduce((sum, item) => sum + item.stockValue, 0);
  const remainingStockValue = remainingItems.reduce((sum, item) => sum + item.value, 0);
  const stockShortages = remainingItems.filter((item) => item.remainingQuantity < 0);
  const filteredRemaining = remainingItems.filter((item) =>
    item.name.toLocaleLowerCase("ar").includes(needle),
  );
  const filteredTransfers = transfers.filter((transfer) =>
    transfer.item_name.toLocaleLowerCase("ar").includes(needle),
  );
  const filteredShopPurchases = supplierPurchases.filter((purchase) =>
    purchase.item_name.toLocaleLowerCase("ar").includes(needle),
  );
  const filteredPurchases = purchases.filter((purchase) =>
    purchase.item_name.toLocaleLowerCase("ar").includes(needle),
  );
  const shopRows = [
    ...filteredTransfers.map((transfer) => ({
      id: transfer.id,
      source: "warehouse" as const,
      item_name: transfer.item_name,
      quantity: Number(transfer.quantity),
      wholesale_price: Number(transfer.wholesale_price),
      date: transfer.transfer_date,
      transfer,
    })),
    ...filteredShopPurchases.map((purchase) => ({
      id: purchase.id,
      source: "supplier" as const,
      item_name: purchase.item_name,
      quantity: purchase.quantity,
      wholesale_price: purchase.wholesale_price,
      date: purchase.purchase_date,
      transfer: null,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const warehouseTransferValue = transfers.reduce(
    (sum, transfer) => sum + Number(transfer.quantity) * Number(transfer.wholesale_price),
    0,
  );
  const supplierPurchaseValue = supplierPurchases.reduce(
    (sum, purchase) => sum + purchase.quantity * purchase.wholesale_price,
    0,
  );
  const shopPurchaseValue = warehouseTransferValue + supplierPurchaseValue;

  const activity = useMemo(() => {
    const entries = [
      ...transfers.map((transfer) => ({
        id: `transfer-${transfer.id}`,
        kind: "نقل للمحل",
        item: transfer.item_name,
        quantity: NUM(Number(transfer.quantity)),
        value: Number(transfer.quantity) * Number(transfer.wholesale_price),
        date: transfer.transfer_date,
        createdAt: transfer.created_at,
        effect: "إضافة إلى فلوس مردودة وخصم من المخزن",
        direction: "in" as const,
      })),
      ...purchases.map((purchase) => ({
        id: `purchase-${purchase.id}`,
        kind: "شراء جديد",
        item: purchase.item_name,
        quantity: NUM(Number(purchase.quantity)),
        value: Number(purchase.quantity) * Number(purchase.wholesale_price),
        date: purchase.purchase_date,
        createdAt: purchase.created_at,
        effect: "خصم من فلوس مردودة وإضافة إلى المخزن",
        direction: "out" as const,
      })),
      ...settlements.map((settlement) => ({
        id: `settlement-${settlement.id}`,
        kind: "تسوية",
        item: settlement.note || "—",
        quantity: "—",
        value: Number(settlement.amount),
        date: settlement.settlement_date,
        createdAt: settlement.created_at,
        effect: "خصم من فلوس مردودة",
        direction: "out" as const,
      })),
    ];
    return entries.sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  }, [transfers, purchases, settlements]);

  const startLockedMutation = (run: () => void) => {
    if (mutationLock.current) return;
    mutationLock.current = true;
    run();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!dialog) return;
    const quantity = Number(form.quantity);
    const price = Number(form.price);
    if (dialog.kind === "item") {
      if (!form.name.trim()) return toast.error("اكتب اسم الصنف");
      if (!Number.isInteger(quantity) || quantity < 0)
        return toast.error("أدخل كمية صحيحة كرقم صحيح");
      if (!Number.isFinite(price) || price < 0) return toast.error("اكتب سعر جملة صحيحاً");
      startLockedMutation(() =>
        itemMutation.mutate({
          id: dialog.item?.id,
          name: form.name.trim(),
          quantity,
          price,
        }),
      );
    } else if (dialog.kind === "transfer") {
      if (!dialog.transfer && !form.itemId) return toast.error("اختر الصنف");
      if (!Number.isInteger(quantity) || quantity <= 0)
        return toast.error("أدخل كمية صحيحة أكبر من صفر");
      startLockedMutation(() =>
        transferMutation.mutate({
          id: dialog.transfer?.id,
          itemId: form.itemId,
          quantity,
          date: form.date,
        }),
      );
    } else if (dialog.kind === "purchase") {
      const isNewItem = !dialog.purchase && form.itemId === "__new__";
      if (!dialog.purchase && !form.itemId) return toast.error("اختر الصنف أو أضف صنفاً جديداً");
      if (isNewItem && !form.name.trim()) return toast.error("اكتب اسم الصنف الجديد");
      if (!Number.isInteger(quantity) || quantity <= 0)
        return toast.error("أدخل كمية صحيحة أكبر من صفر");
      if (!Number.isFinite(price) || price < 0) return toast.error("اكتب سعر جملة صحيحاً");
      const purchaseValue = quantity * price;
      if (purchaseValue > purchaseAvailableBalance + 0.005) {
        return toast.error(
          `قيمة الشراء ${EGP(purchaseValue)} أكبر من المردود المتاح ${EGP(purchaseAvailableBalance)}`,
        );
      }
      startLockedMutation(() =>
        purchaseMutation.mutate({
          id: dialog.purchase?.id,
          itemId: isNewItem ? "" : form.itemId,
          name: form.name.trim(),
          quantity,
          price,
          date: form.date,
        }),
      );
    } else if (dialog.kind === "settlement") {
      if (!Number.isFinite(price) || price <= 0) return toast.error("اكتب مبلغاً أكبر من صفر");
      startLockedMutation(() =>
        settlementMutation.mutate({ amount: price, date: form.date, note: form.note.trim() }),
      );
    }
  };

  const deleteRecord = (message: string, run: () => void) => {
    if (!window.confirm(message)) return;
    startLockedMutation(run);
  };

  const mutationPending =
    itemMutation.isPending ||
    deleteItemMutation.isPending ||
    transferMutation.isPending ||
    deleteTransferMutation.isPending ||
    purchaseMutation.isPending ||
    deletePurchaseMutation.isPending ||
    settlementMutation.isPending;

  return (
    <AppShell title="مخازن السجائر">
      <div className="space-y-6">
        {warehouseQ.isError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <span>تعذر تحميل بيانات مخزن السجائر: {warehouseQ.error.message}</span>
            <Button variant="outline" size="sm" onClick={() => warehouseQ.refetch()}>
              <RefreshCw className="ms-1 size-4" />
              إعادة المحاولة
            </Button>
          </div>
        )}

        <section className="relative overflow-hidden rounded-3xl bg-gradient-primary p-6 text-primary-foreground shadow-elevated sm:p-8">
          <div className="absolute -left-10 -top-14 size-48 rounded-full bg-white/5 blur-2xl" />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
            <div className="grid size-14 place-items-center rounded-2xl border border-white/20 bg-white/10">
              <Wallet className="size-7" />
            </div>
            <h2 className="text-sm font-bold opacity-90">رأس المال الأساسي</h2>
            {warehouseQ.isLoading ? (
              <div className="h-12 w-48 animate-pulse rounded-lg bg-white/15" />
            ) : warehouseQ.isError ? (
              <div className="text-4xl font-black tracking-tight sm:text-5xl">—</div>
            ) : (
              <div className="text-4xl font-black tracking-tight sm:text-5xl">
                {data?.settings ? EGP(Number(data.settings.base_capital)) : "غير مسجل"}
              </div>
            )}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              <CalendarDays className="size-4" />
              <span>
                تاريخ بداية رأس المال:{" "}
                {data?.settings?.start_date ? DATE_AR(data.settings.start_date) : "—"}
              </span>
            </div>
            <p className="max-w-xl text-xs leading-6 opacity-80">
              قيمة تأسيسية ثابتة للتوثيق، لا تتغير مع عمليات النقل أو الشراء.
            </p>
            <div className="mt-1 flex min-w-64 flex-col items-center gap-1 rounded-xl border border-white/20 bg-white/10 px-5 py-3">
              <span className="text-xs font-bold opacity-85">
                إجمالي فلوس الباقي في المخزن + فلوس مردودة
              </span>
              <span className="text-xl font-black">
                {warehouseQ.isLoading || warehouseQ.isError
                  ? "—"
                  : EGP(remainingStockValue + returnedBalance)}
              </span>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
            <div>
              <p className="text-sm font-bold text-muted-foreground">فلوس مردودة</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {warehouseQ.isLoading || warehouseQ.isError ? "—" : EGP(returnedBalance)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                إجمالي مشتريات المحل − المشتريات الجديدة − التسويات
              </p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-success/10 text-success">
              <ArrowDownLeft className="size-6" />
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
            <div>
              <p className="text-sm font-bold text-muted-foreground">فلوس المخزن</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {warehouseQ.isLoading || warehouseQ.isError ? "—" : EGP(remainingStockValue)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                قيمة الكميات المتبقية بسعر الجملة
              </p>
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-info/10 text-info">
              <Boxes className="size-6" />
            </span>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث عن صنف في الجداول..."
              className="h-11 rounded-xl pe-10"
              aria-label="البحث عن صنف"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => openDialog({ kind: "item" })}
              variant="outline"
              className="flex-1 sm:flex-none"
            >
              <Plus className="ms-1 size-4" />
              إضافة صنف
            </Button>
            <Button
              onClick={() => openDialog({ kind: "transfer" })}
              className="flex-1 sm:flex-none"
            >
              <ArrowUpRight className="ms-1 size-4" />
              نقل للمحل
            </Button>
            <Button
              onClick={() => openDialog({ kind: "purchase" })}
              variant="secondary"
              className="flex-1 sm:flex-none"
            >
              <ShoppingCart className="ms-1 size-4" />
              شراء جديد
            </Button>
            <Button
              onClick={() => openDialog({ kind: "settlement" })}
              variant="outline"
              className="flex-1 sm:flex-none"
            >
              <Banknote className="ms-1 size-4" />
              تسجيل تسوية
            </Button>
          </div>
        </div>

        {warehouseQ.isLoading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((key) => (
              <div
                key={key}
                className="h-72 animate-pulse rounded-2xl border border-border bg-card"
              />
            ))}
          </div>
        ) : warehouseQ.isError ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            تعذر عرض الجداول حتى يتم تحميل بيانات المخزن.
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard
              title="مخزن"
              icon={Cigarette}
              description="المخزون الأساسي والمشتريات الجديدة قبل خصم المنقول للمحل"
              action={
                <Button size="sm" variant="outline" onClick={() => openDialog({ kind: "item" })}>
                  <Plus className="ms-1 size-4" />
                  صنف
                </Button>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-right font-bold">اسم الصنف</th>
                      <th className="px-4 py-3 text-right font-bold">الكمية</th>
                      <th className="px-4 py-3 text-right font-bold">سعر الجملة</th>
                      <th className="px-4 py-3 text-right font-bold">إجمالي القيمة</th>
                      <th className="px-4 py-3 text-center font-bold">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRemaining.length === 0 ? (
                      <EmptyRows
                        columns={5}
                        message={
                          items.length
                            ? "لا توجد أصناف تطابق البحث."
                            : "لا توجد أصناف بعد. أضف أول صنف للمخزن."
                        }
                      />
                    ) : (
                      filteredRemaining.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-bold">{item.name}</td>
                          <td className="px-4 py-3">{NUM(item.stockQuantity)}</td>
                          <td className="px-4 py-3">{EGP(item.stockUnitPrice)}</td>
                          <td className="px-4 py-3 font-bold">{EGP(item.stockValue)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-1">
                              <button
                                type="button"
                                title="تعديل الصنف"
                                onClick={() => openDialog({ kind: "item", item })}
                                className="rounded-lg p-2 text-primary hover:bg-primary/10"
                              >
                                <Pencil className="size-4" />
                              </button>
                              <button
                                type="button"
                                disabled={mutationPending || Number(item.quantity) > 0}
                                title={
                                  Number(item.quantity) > 0
                                    ? "صفّر الكمية الأساسية قبل الحذف"
                                    : "حذف الصنف"
                                }
                                onClick={() =>
                                  deleteRecord("حذف الصنف؟ لا يمكن حذف صنف له عمليات سابقة.", () =>
                                    deleteItemMutation.mutate(item.id),
                                  )
                                }
                                className="rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/40">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-extrabold">
                        إجمالي قيمة المخزون الداخل
                      </td>
                      <td colSpan={2} className="px-4 py-3 font-black text-primary">
                        {EGP(warehouseStockValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="مشتريات المحل"
              icon={ArrowUpRight}
              description="النقل من المخزن والوارد المسجل لجهة الشراء الونش🏡"
              action={
                <Button size="sm" onClick={() => openDialog({ kind: "transfer" })}>
                  <Plus className="ms-1 size-4" />
                  نقل للمحل
                </Button>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-right font-bold">اسم الصنف</th>
                      <th className="px-4 py-3 text-right font-bold">المصدر</th>
                      <th className="px-4 py-3 text-right font-bold">الكمية</th>
                      <th className="px-4 py-3 text-right font-bold">سعر الجملة</th>
                      <th className="px-4 py-3 text-right font-bold">إجمالي القيمة</th>
                      <th className="px-4 py-3 text-right font-bold">التاريخ</th>
                      <th className="px-4 py-3 text-center font-bold">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {shopRows.length === 0 ? (
                      <EmptyRows
                        columns={7}
                        message="لا توجد عمليات نقل أو وارد من الونش🏡 تطابق البحث."
                      />
                    ) : (
                      shopRows.map((row) => (
                        <tr key={`${row.source}-${row.id}`} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-bold">{row.item_name}</td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                row.source === "supplier"
                                  ? "rounded-full bg-info/10 px-2 py-1 text-xs font-bold text-info"
                                  : "rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary"
                              }
                            >
                              {row.source === "supplier" ? "الوارد — الونش🏡" : "نقل من المخزن"}
                            </span>
                          </td>
                          <td className="px-4 py-3">{NUM(row.quantity)}</td>
                          <td className="px-4 py-3">{EGP(row.wholesale_price)}</td>
                          <td className="px-4 py-3 font-bold">
                            {EGP(row.quantity * row.wholesale_price)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{DATE_AR(row.date)}</td>
                          <td className="px-4 py-3">
                            {row.transfer ? (
                              <div className="flex justify-center gap-1">
                                <button
                                  type="button"
                                  title="تعديل عملية النقل"
                                  onClick={() =>
                                    openDialog({ kind: "transfer", transfer: row.transfer! })
                                  }
                                  className="rounded-lg p-2 text-primary hover:bg-primary/10"
                                >
                                  <Pencil className="size-4" />
                                </button>
                                <button
                                  type="button"
                                  title="حذف عملية النقل"
                                  disabled={mutationPending}
                                  onClick={() =>
                                    deleteRecord("حذف عملية النقل؟", () =>
                                      deleteTransferMutation.mutate(row.transfer!.id),
                                    )
                                  }
                                  className="rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">من صفحة الوارد</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/40">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 font-extrabold">
                        إجمالي وارد الونش🏡
                      </td>
                      <td colSpan={3} className="px-4 py-3 font-black text-info">
                        {EGP(supplierPurchaseValue)}
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td colSpan={4} className="px-4 py-3 font-extrabold">
                        إجمالي المنقول من المخزن
                      </td>
                      <td colSpan={3} className="px-4 py-3 font-black text-primary">
                        {EGP(warehouseTransferValue)}
                      </td>
                    </tr>
                    <tr className="border-t border-border">
                      <td colSpan={4} className="px-4 py-3 font-extrabold">
                        إجمالي مشتريات المحل (المنقول + وارد الونش)
                      </td>
                      <td colSpan={3} className="px-4 py-3 font-black text-foreground">
                        {EGP(shopPurchaseValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="الباقي في المخزن"
              icon={Boxes}
              description="حساب تلقائي: رصيد المخزن + مشتريات المخزن الجديدة − كل المنقول للمحل"
            >
              {stockShortages.length > 0 && (
                <div
                  role="alert"
                  className="m-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                >
                  <p className="font-bold">بعض حركات المحل أكبر من رصيد المخزن المسجل:</p>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {stockShortages.map((item) => (
                      <li key={item.id}>
                        {item.name}: عجز {NUM(Math.abs(item.remainingQuantity))} علبة
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    راجع رصيد الصنف في جدول «مخزن» أو سجلات الوارد والنقل؛ لم يتم إخفاء العجز من
                    الحساب.
                  </p>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-right font-bold">اسم الصنف</th>
                      <th className="px-4 py-3 text-right font-bold">الكمية المتبقية</th>
                      <th className="px-4 py-3 text-right font-bold">سعر الجملة</th>
                      <th className="px-4 py-3 text-right font-bold">إجمالي القيمة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRemaining.length === 0 ? (
                      <EmptyRows columns={4} message="لا توجد أصناف تطابق البحث." />
                    ) : (
                      filteredRemaining.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-bold">{item.name}</td>
                          <td className="px-4 py-3">{NUM(item.remainingQuantity)}</td>
                          <td className="px-4 py-3">{EGP(item.remainingUnitPrice)}</td>
                          <td className="px-4 py-3 font-bold">{EGP(item.value)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/40">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-extrabold">
                        إجمالي قيمة الباقي
                      </td>
                      <td className="px-4 py-3 font-black text-primary">
                        {EGP(remainingStockValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="المشتريات الجديدة"
              icon={ShoppingCart}
              description="شراء بضاعة جديدة من رصيد فلوس مردودة"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openDialog({ kind: "purchase" })}
                >
                  <Plus className="ms-1 size-4" />
                  تسجيل شراء
                </Button>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-right font-bold">اسم الصنف</th>
                      <th className="px-4 py-3 text-right font-bold">الكمية المشتراة</th>
                      <th className="px-4 py-3 text-right font-bold">سعر الجملة</th>
                      <th className="px-4 py-3 text-right font-bold">إجمالي الشراء</th>
                      <th className="px-4 py-3 text-right font-bold">تاريخ الشراء</th>
                      <th className="px-4 py-3 text-center font-bold">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPurchases.length === 0 ? (
                      <EmptyRows columns={6} message="لا توجد مشتريات جديدة تطابق البحث." />
                    ) : (
                      filteredPurchases.map((purchase) => (
                        <tr key={purchase.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-bold">{purchase.item_name}</td>
                          <td className="px-4 py-3">{NUM(Number(purchase.quantity))}</td>
                          <td className="px-4 py-3">{EGP(Number(purchase.wholesale_price))}</td>
                          <td className="px-4 py-3 font-bold">
                            {EGP(Number(purchase.quantity) * Number(purchase.wholesale_price))}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {DATE_AR(purchase.purchase_date)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-center gap-1">
                              <button
                                type="button"
                                title="تعديل سجل الشراء"
                                onClick={() => openDialog({ kind: "purchase", purchase })}
                                className="rounded-lg p-2 text-primary hover:bg-primary/10"
                              >
                                <Pencil className="size-4" />
                              </button>
                              <button
                                type="button"
                                title="حذف سجل الشراء"
                                disabled={mutationPending}
                                onClick={() =>
                                  deleteRecord("حذف سجل الشراء؟", () =>
                                    deletePurchaseMutation.mutate(purchase.id),
                                  )
                                }
                                className="rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-border bg-muted/40">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-extrabold">
                        إجمالي المشتريات الجديدة
                      </td>
                      <td colSpan={3} className="px-4 py-3 font-black text-primary">
                        {EGP(
                          purchases.reduce(
                            (sum, purchase) =>
                              sum + Number(purchase.quantity) * Number(purchase.wholesale_price),
                            0,
                          ),
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        <SectionCard
          title="سجل العمليات الأخيرة"
          icon={Clock3}
          description="حركة النقل والشراء والتسويات وتأثير كل عملية على الأرصدة"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAllActivity((shown) => !shown)}
              disabled={activity.length <= 10}
            >
              {showAllActivity ? "عرض الأحدث فقط" : "عرض السجل الكامل"}
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-right font-bold">نوع العملية</th>
                  <th className="px-4 py-3 text-right font-bold">الصنف / البيان</th>
                  <th className="px-4 py-3 text-right font-bold">الكمية</th>
                  <th className="px-4 py-3 text-right font-bold">القيمة</th>
                  <th className="px-4 py-3 text-right font-bold">التاريخ</th>
                  <th className="px-4 py-3 text-right font-bold">تأثير العملية على الأرصدة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activity.length === 0 ? (
                  <EmptyRows columns={6} message="لا توجد عمليات مسجلة حتى الآن." />
                ) : (
                  (showAllActivity ? activity : activity.slice(0, 10)).map((entry) => (
                    <tr key={entry.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-bold">{entry.kind}</td>
                      <td className="px-4 py-3">{entry.item}</td>
                      <td className="px-4 py-3">{entry.quantity}</td>
                      <td className="px-4 py-3 font-bold">{EGP(entry.value)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{DATE_AR(entry.date)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            entry.direction === "in" ? "text-success" : "text-muted-foreground"
                          }
                        >
                          {entry.effect}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <Dialog
          open={dialog !== null}
          onOpenChange={(open) => !open && !mutationPending && closeDialog()}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {dialog?.kind === "item"
                  ? dialog.item
                    ? "تعديل صنف المخزن"
                    : "إضافة صنف للمخزن"
                  : dialog?.kind === "transfer"
                    ? dialog.transfer
                      ? "تعديل عملية النقل"
                      : "نقل بضاعة للمحل"
                    : dialog?.kind === "purchase"
                      ? dialog.purchase
                        ? "تعديل سجل الشراء"
                        : "تسجيل مشتريات جديدة"
                      : "تسجيل تسوية من فلوس مردودة"}
              </DialogTitle>
              <DialogDescription>
                {dialog?.kind === "transfer"
                  ? "يتم خصم الكمية من المتاح وإضافة قيمتها إلى فلوس مردودة."
                  : dialog?.kind === "purchase"
                    ? `المردود المتاح بعد احتساب العملية الحالية: ${EGP(purchaseAvailableBalance)}`
                    : dialog?.kind === "settlement"
                      ? `تخصم التسوية من فلوس مردودة. الرصيد الحالي: ${EGP(returnedBalance)}`
                      : "أدخل بيانات الصنف بسعر الجملة."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {dialog?.kind === "item" && (
                <>
                  <label className="block text-sm font-bold">
                    اسم الصنف
                    <Input
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      className="mt-1.5"
                      maxLength={120}
                      required
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-bold">
                      الكمية الأساسية
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={form.quantity}
                        onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                        className="mt-1.5"
                        required
                      />
                    </label>
                    <label className="block text-sm font-bold">
                      سعر الجملة للعلبة
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.price}
                        onChange={(event) => setForm({ ...form, price: event.target.value })}
                        className="mt-1.5"
                        required
                      />
                    </label>
                  </div>
                </>
              )}

              {dialog?.kind === "transfer" && (
                <>
                  {!dialog.transfer && (
                    <label className="block text-sm font-bold">
                      الصنف
                      <select
                        value={form.itemId}
                        onChange={(event) => setForm({ ...form, itemId: event.target.value })}
                        className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        required
                      >
                        <option value="">اختر الصنف</option>
                        {items.map((item) => {
                          const stock =
                            remainingItems.find((row) => row.id === item.id)?.remainingQuantity ??
                            0;
                          return (
                            <option key={item.id} value={item.id} disabled={stock <= 0}>
                              {item.name} — المتاح {NUM(stock)}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  )}
                  {dialog.transfer && (
                    <p className="rounded-lg bg-muted px-3 py-2 text-sm font-bold">
                      الصنف: {dialog.transfer.item_name}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-bold">
                      الكمية المنقولة
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={form.quantity}
                        onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                        className="mt-1.5"
                        required
                      />
                    </label>
                    <label className="block text-sm font-bold">
                      تاريخ النقل
                      <Input
                        type="date"
                        value={form.date}
                        onChange={(event) => setForm({ ...form, date: event.target.value })}
                        className="mt-1.5"
                        required
                      />
                    </label>
                  </div>
                  {form.itemId && (
                    <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                      قيمة العملية التقديرية:{" "}
                      {EGP(
                        Number(form.quantity || 0) *
                          Number(
                            remainingItems.find((item) => item.id === form.itemId)
                              ?.remainingUnitPrice ?? 0,
                          ),
                      )}
                    </p>
                  )}
                </>
              )}

              {dialog?.kind === "purchase" && (
                <>
                  {!dialog.purchase && (
                    <>
                      <label className="block text-sm font-bold">
                        الصنف
                        <select
                          value={form.itemId}
                          onChange={(event) =>
                            setForm({ ...form, itemId: event.target.value, name: "" })
                          }
                          className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          required
                        >
                          <option value="">اختر صنفاً موجوداً أو أضف صنفاً جديداً</option>
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                          <option value="__new__">+ صنف جديد</option>
                        </select>
                      </label>
                      {form.itemId === "__new__" && (
                        <label className="block text-sm font-bold">
                          اسم الصنف الجديد
                          <Input
                            value={form.name}
                            onChange={(event) => setForm({ ...form, name: event.target.value })}
                            className="mt-1.5"
                            maxLength={120}
                            required
                          />
                        </label>
                      )}
                    </>
                  )}
                  {dialog.purchase && (
                    <p className="rounded-lg bg-muted px-3 py-2 text-sm font-bold">
                      الصنف: {dialog.purchase.item_name}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-bold">
                      الكمية المشتراة
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={form.quantity}
                        onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                        className="mt-1.5"
                        required
                      />
                    </label>
                    <label className="block text-sm font-bold">
                      سعر الجملة للعلبة
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.price}
                        onChange={(event) => setForm({ ...form, price: event.target.value })}
                        className="mt-1.5"
                        required
                      />
                    </label>
                  </div>
                  <label className="block text-sm font-bold">
                    تاريخ الشراء
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(event) => setForm({ ...form, date: event.target.value })}
                      className="mt-1.5"
                      required
                    />
                  </label>
                  <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    قيمة الشراء: {EGP(Number(form.quantity || 0) * Number(form.price || 0))}
                    {" · "}
                    المردود بعد الشراء:{" "}
                    {EGP(
                      purchaseAvailableBalance -
                        Number(form.quantity || 0) * Number(form.price || 0),
                    )}
                  </p>
                </>
              )}

              {dialog?.kind === "settlement" && (
                <>
                  <label className="block text-sm font-bold">
                    مبلغ التسوية
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.price}
                      onChange={(event) => setForm({ ...form, price: event.target.value })}
                      className="mt-1.5"
                      required
                    />
                  </label>
                  <label className="block text-sm font-bold">
                    التاريخ
                    <Input
                      type="date"
                      value={form.date}
                      onChange={(event) => setForm({ ...form, date: event.target.value })}
                      className="mt-1.5"
                      required
                    />
                  </label>
                  <label className="block text-sm font-bold">
                    ملاحظة
                    <Input
                      value={form.note}
                      onChange={(event) => setForm({ ...form, note: event.target.value })}
                      className="mt-1.5"
                      maxLength={240}
                      placeholder="اختياري"
                    />
                  </label>
                </>
              )}

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeDialog}
                  disabled={mutationPending}
                >
                  إلغاء
                </Button>
                <Button type="submit" disabled={mutationPending}>
                  {mutationPending ? "جارٍ الحفظ..." : "حفظ العملية"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
