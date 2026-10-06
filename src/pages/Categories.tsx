import { useState, FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { ReferenceRecord } from "../data/contracts";
import { useT } from "../i18n";
import { DataTable, DataColumn } from "../components/DataTable";
import { Badge, Button, Field, SelectField } from "../components/ui";
import { Dialog, MutationFeedback, PageHeader } from "../components/WorkflowUi";

/** Standard AIMS asset categories, always offered in the Category dropdown. */
export const STANDARD_CATEGORIES = [
  "Computers",
  "Display & Presentation",
  "Network",
  "Print & Scan",
  "Mobile Devices",
  "Telephony",
  "Peripherals",
  "Power & Electrical",
  "Cables",
  "Adapters",
  "Servers & Infrastructure",
  "Storage Media",
  "Audio Visual Equipment",
  "Security",
] as const;

const PRESET_PREFIX = "preset:";
const EMPTY = "\u2014";

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export const CategoriesPage = () => {
  const { user, language } = useApp();
  const snapshot = useMockSnapshot();
  const t = useT();
  const nl = language === "nl";
  const navigate = useNavigate();
  const params = useParams();

  const [searchParams] = useSearchParams();
  const isEditing = Boolean(params.categoryId) || searchParams.get("new") === "true";

  const allRefs = snapshot.references.filter(r => r.kind === "category");
  const assetTypes = allRefs.filter(r => !r.details?.level || r.details?.level === "asset_name");
  const topCategories = allRefs.filter(r => r.details?.level === "category");

  const categoryName = (item: ReferenceRecord) =>
    topCategories.find(c => c.id === String(item.details?.categoryId))?.name ||
    String(item.details?.categoryName || "");

  const activeAssetCount = (item: ReferenceRecord) =>
    snapshot.assets.filter(a => a.category === item.name && !["Archived", "Disposed"].includes(a.status)).length;

  const columns: DataColumn<ReferenceRecord>[] = [
    {
      id: "name",
      label: t("categories.assetName"),
      render: (item) => <strong>{item.name}</strong>,
      text: (item) => item.name,
      sortable: true,
    },
    {
      id: "category",
      label: t("categories.category"),
      render: (item) => categoryName(item) || EMPTY,
      text: (item) => categoryName(item),
      sortable: true,
    },
    {
      id: "tracking",
      label: t("categories.trackingType"),
      render: (item) => item.type || EMPTY,
      text: (item) => item.type || "",
      sortable: true,
    },
    {
      id: "codeGroup",
      label: t("categories.codeGroup"),
      render: (item) => String(item.details?.codeGroup || EMPTY),
      text: (item) => String(item.details?.codeGroup || ""),
      sortable: true,
    },
    {
      id: "activeAssets",
      label: t("categories.activeAssets"),
      render: (item) => activeAssetCount(item),
      text: (item) => String(activeAssetCount(item)),
      sortable: true,
    },
    {
      id: "status",
      label: t("categories.status"),
      render: (item) => (
        <Badge tone={item.status === "Active" ? "success" : "neutral"}>
          {item.status}
        </Badge>
      ),
      text: (item) => item.status,
    },
  ];

  return (
    <div className="page data-page">
      <PageHeader
        title={t("routes.categories")}
        description={nl ? "Beheer hi\u00ebrarchische asset types en classificaties." : "Manage hierarchical asset types and classifications."}
        actions={user ? <Button onClick={() => navigate("/categories/new?new=true")}><Plus size={16} /> {t("categories.addAssetType")}</Button> : undefined}
      />

      <section className="card data-card"><DataTable
        rows={assetTypes}
        columns={columns as any}
        id="categories-table" rowKey={(r) => r.id} searchPlaceholder="Search..." emptyTitle="No categories" emptyDescription="No categories found."
        onRowClick={user ? (row) => navigate(`/categories/${row.id}/edit`) : undefined}
      /></section>{isEditing && (
        <CategoryModal
          onClose={() => navigate("/categories")}
        />
      )}
    </div>
  );
};

const CategoryModal = ({ onClose }: { onClose: () => void }) => {
  const { user, language } = useApp();
  const snapshot = useMockSnapshot();
  const repository = useRepository();
  const t = useT();
  const nl = language === "nl";
  const params = useParams();

  const isEditing = Boolean(params.categoryId);
  const existing = isEditing ? snapshot.references.find(r => r.id === params.categoryId) : null;

  const allRefs = snapshot.references.filter(r => r.kind === "category");
  const topCategories = allRefs.filter(r => r.details?.level === "category");
  const assetTypes = allRefs.filter(r => !r.details?.level || r.details?.level === "asset_name");

  // Category options: every standard category (backed by its stored record when one exists)
  // plus any additional categories that were added via "Add category".
  const categoryOptions = [
    ...STANDARD_CATEGORIES.map(name => {
      const record = topCategories.find(c => normalize(c.name) === normalize(name));
      return { value: record ? record.id : `${PRESET_PREFIX}${name}`, name };
    }),
    ...topCategories
      .filter(c => !STANDARD_CATEGORIES.some(name => normalize(name) === normalize(c.name)))
      .map(c => ({ value: c.id, name: c.name })),
  ];

  const initialCategory = () => {
    const id = String(existing?.details?.categoryId || "");
    if (id && categoryOptions.some(o => o.value === id)) return id;
    const storedName = String(existing?.details?.categoryName || topCategories.find(c => c.id === id)?.name || "");
    return categoryOptions.find(o => storedName && normalize(o.name) === normalize(storedName))?.value || "";
  };

  const [categoryId, setCategoryId] = useState(initialCategory);
  const [assetName, setAssetName] = useState(existing?.name || "");
  const [trackingType, setTrackingType] = useState(existing?.type || "Serialized");
  const [codeGroup, setCodeGroup] = useState(String(existing?.details?.codeGroup || ""));
  const [status, setStatus] = useState(existing?.status || "Active");

  const [inlineCreate, setInlineCreate] = useState(false);
  const [feedback, setFeedback] = useState<{status: 'idle'|'loading'|'success'|'error', message: string}>({status: 'idle', message: ''});

  const categoryNameOf = (record: ReferenceRecord) =>
    String(record.details?.categoryName || topCategories.find(c => c.id === String(record.details?.categoryId))?.name || "");

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback({status: 'idle', message: ''});

    if (!assetName.trim()) {
      setFeedback({status: 'error', message: nl ? "Assetnaam is verplicht." : "Asset name is required."});
      return;
    }
    const selected = categoryOptions.find(o => o.value === categoryId);
    if (!selected) {
      setFeedback({status: 'error', message: nl ? "Categorie is verplicht." : "Category is required."});
      return;
    }

    if (!isEditing) {
      const dup = assetTypes.find(a => normalize(a.name) === normalize(assetName) && normalize(categoryNameOf(a)) === normalize(selected.name));
      if (dup) {
        setFeedback({status: 'error', message: nl ? "Deze assetnaam bestaat al in deze categorie." : "This asset name already exists in this category."});
        return;
      }
    }

    setFeedback({status: 'loading', message: 'Saving...'});

    // A standard category without a stored record yet is created on first use.
    let resolvedCategoryId = categoryId;
    if (categoryId.startsWith(PRESET_PREFIX)) {
      const created = await repository.execute({
        action: "reference.create",
        actor: user?.name || user?.email || "System",
        values: { kind: "category", name: selected.name, status: "Active", type: "Hierarchy", details: { level: "category" } },
      });
      if (!created.ok) {
        setFeedback({status: 'error', message: created.message});
        return;
      }
      resolvedCategoryId = created.entityId || "";
    }

    const details = {
      ...(existing?.details || {}),
      level: "asset_name",
      categoryId: resolvedCategoryId || undefined,
      categoryName: selected.name,
      codeGroup: codeGroup === "" ? undefined : codeGroup,
    };

    const res = await repository.execute({
      action: isEditing ? "reference.edit" : "reference.create",
      entityId: existing?.id,
      actor: user?.name || user?.email || "System",
      values: {
        kind: "category",
        name: assetName,
        type: trackingType,
        status: status as any,
        details,
        parentId: resolvedCategoryId || undefined
      }
    });

    if (!res.ok) {
      setFeedback({status: 'error', message: res.message});
    } else {
      setFeedback({status: 'success', message: 'Saved successfully.'});
      setTimeout(onClose, 300);
    }
  };

  return (
      <>
      <Dialog
        open={true}
        title={isEditing ? (nl ? "Assettype bewerken" : "Edit asset type") : t("categories.addAssetType")}
        onClose={onClose}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={feedback.status === 'loading'}>
              {nl ? "Annuleren" : "Cancel"}
            </Button>
            <Button variant="primary" onClick={() => {
              const form = document.getElementById("asset-type-form") as HTMLFormElement;
              if (form) form.requestSubmit();
            }} disabled={feedback.status === 'loading'}>
              {feedback.status === 'loading' ? "..." : (nl ? "Opslaan" : "Save")}
            </Button>
          </>
        }
      >
        <form id="asset-type-form" onSubmit={handleSave} className="form-stack">
          <MutationFeedback {...feedback} />

          <SelectField
            label={t("categories.category")}
            value={categoryId}
            required
            onChange={e => {
              if (e.target.value === "__add__") {
                setInlineCreate(true);
                return;
              }
              setCategoryId(e.target.value);
            }}
          >
            <option value="">{nl ? "Selecteer categorie..." : "Select category..."}</option>
            {categoryOptions.map(c => <option key={c.value} value={c.value}>{c.name}</option>)}
            <option value="__add__">{t("categories.addCategory")}</option>
          </SelectField>

          <div style={{display: 'flex', gap: '1rem'}}>
            <div style={{flex: 1}}>
              <Field
                label={t("categories.assetName")}
                value={assetName}
                required
                onChange={e => setAssetName(e.target.value)}
              />
            </div>
            <div style={{flex: 1}}>
              <SelectField
                label={t("categories.trackingType")}
                value={trackingType}
                required
                onChange={e => setTrackingType(e.target.value)}
              >
                <option value="Serialized">Serialized</option>
                <option value="Quantity-based">Quantity-based</option>
              </SelectField>
            </div>
          </div>

          <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
            <div style={{flex: 1}}>
              <SelectField
                label={t("categories.codeGroup")}
                value={codeGroup}
                disabled={trackingType !== "Serialized"}
                onChange={e => setCodeGroup(e.target.value)}
              >
                <option value="">{nl ? "Geen (of niet van toepassing)" : "None (or N/A)"}</option>
                {snapshot.codeGroups.map(g => <option key={g.id} value={g.prefix}>{g.prefix} - {g.name}</option>)}
              </SelectField>
            </div>
            <div style={{flex: 1}}>
              <SelectField
                label={t("categories.status")}
                value={status}
                required
                onChange={e => setStatus(e.target.value as any)}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </SelectField>
            </div>
          </div>
        </form>
      </Dialog>

      {inlineCreate && (
        <AddCategoryModal
          onClose={() => setInlineCreate(false)}
          onSuccess={(id) => { setInlineCreate(false); setCategoryId(id); }}
        />
      )}
    </>
  );
};

const AddCategoryModal = ({ onClose, onSuccess }: { onClose: () => void, onSuccess: (id: string) => void }) => {
  const { user, language } = useApp();
  const snapshot = useMockSnapshot();
  const repository = useRepository();
  const nl = language === "nl";
  const t = useT();

  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState<{status: 'idle'|'loading'|'success'|'error', message: string}>({status: 'idle', message: ''});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback({status: 'idle', message: ''});
    const trimmed = name.trim();
    if (!trimmed) {
      setFeedback({status: 'error', message: nl ? "Naam is verplicht." : "Name is required."});
      return;
    }

    const isDuplicate =
      snapshot.references.some(r => r.kind === "category" && r.details?.level === "category" && normalize(r.name) === normalize(trimmed)) ||
      STANDARD_CATEGORIES.some(n => normalize(n) === normalize(trimmed));
    if (isDuplicate) {
      setFeedback({status: 'error', message: nl ? "Deze categorie bestaat al." : "This category already exists."});
      return;
    }

    setFeedback({status: 'loading', message: 'Saving...'});

    const res = await repository.execute({
      action: "reference.create",
      actor: user?.name || user?.email || "System",
      values: { kind: "category", name: trimmed, status: "Active", type: "Hierarchy", details: { level: "category" } }
    });

    if (!res.ok) {
      setFeedback({status: 'error', message: res.message});
      return;
    }
    setFeedback({status: 'success', message: 'Saved successfully.'});
    setTimeout(() => {
      const newlyAdded = repository.snapshot().references.find(r => r.kind === "category" && r.name === trimmed && r.details?.level === "category");
      onSuccess(res.entityId || newlyAdded?.id || "");
    }, 500);
  };

  return (
    <Dialog
      open={true}
      title={t("categories.addCategory")}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={feedback.status === 'loading'}>
            {nl ? "Annuleren" : "Cancel"}
          </Button>
          <Button variant="primary" onClick={() => {
            const form = document.getElementById("inline-create-form") as HTMLFormElement;
            if (form) form.requestSubmit();
          }} disabled={feedback.status === 'loading'}>
            {feedback.status === 'loading' ? "..." : (nl ? "Opslaan" : "Save")}
          </Button>
        </>
      }
    >
      <form id="inline-create-form" onSubmit={handleSubmit} className="form-stack">
        <MutationFeedback {...feedback} />
        <Field
          label={nl ? "Naam" : "Name"}
          value={name}
          onChange={e => setName(e.target.value)}
          required
          autoFocus
        />
      </form>
    </Dialog>
  );
};




