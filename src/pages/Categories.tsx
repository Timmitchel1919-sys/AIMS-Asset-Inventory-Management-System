import { useState, useMemo, FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Plus, Edit3 } from "lucide-react";
import { useApp } from "../context/AppContext";
import { useMockSnapshot, useRepository } from "../data/repositoryContext";
import { ReferenceRecord } from "../data/contracts";
import { useT } from "../i18n";
import { DataTable, DataColumn } from "../components/DataTable";
import { Badge, Button, Field, SelectField } from "../components/ui";
import { Dialog, MutationFeedback, PageHeader } from "../components/WorkflowUi";

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
  const subCategories = allRefs.filter(r => r.details?.level === "subcategory");

  const resolveCat = (id?: string) => topCategories.find(c => c.id === id);
  const resolveSub = (id?: string) => subCategories.find(s => s.id === id);

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
      render: (item) => resolveCat(String(item.details?.categoryId))?.name || "—",
      text: (item) => resolveCat(String(item.details?.categoryId))?.name || "",
      sortable: true,
    },
    {
      id: "subcategory",
      label: t("categories.subCategory"),
      render: (item) => resolveSub(String(item.details?.subCategoryId))?.name || "—",
      text: (item) => resolveSub(String(item.details?.subCategoryId))?.name || "",
      sortable: true,
    },
    {
      id: "tracking",
      label: t("categories.trackingType"),
      render: (item) => item.type || "—",
      text: (item) => item.type || "",
      sortable: true,
    },
    {
      id: "codeGroup",
      label: t("categories.codeGroup"),
      render: (item) => String(item.details?.codeGroup || "—"),
      text: (item) => String(item.details?.codeGroup || ""),
      sortable: true,
    },
    {
      id: "activeAssets",
      label: t("categories.activeAssets"),
      render: (item) => {
        const count = snapshot.assets.filter(a => a.category === item.name && !['Archived','Disposed'].includes(a.status)).length;
        return count;
      },
      text: (item) => {
        const count = snapshot.assets.filter(a => a.category === item.name && !['Archived','Disposed'].includes(a.status)).length;
        return String(count);
      },
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

  if (user) {
    columns.push({
      id: "actions",
      label: "",
      render: (item) => (
        <Button variant="ghost" onClick={() => navigate(`/categories/${item.id}/edit`)}>
          <Edit3 size={16} />
        </Button>
      ),
      text: () => "",
    });
  }

  return (
    <>
      <PageHeader
        title={t("routes.categories")}
        description={nl ? "Beheer hiërarchische asset types en classificaties." : "Manage hierarchical asset types and classifications."}
        actions={user ? <Button onClick={() => navigate("/categories/new?new=true")}><Plus size={16} /> {t("categories.addAssetType")}</Button> : undefined}
      />
      
      <DataTable
        rows={assetTypes}
        columns={columns as any}
        id="categories-table" rowKey={(r) => r.id} searchPlaceholder="Search..." emptyTitle="No categories" emptyDescription="No categories found."
      />

      {isEditing && (
        <CategoryModal
          onClose={() => navigate("/categories")}
        />
      )}
    </>
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
  const subCategories = allRefs.filter(r => r.details?.level === "subcategory");
  const assetTypes = allRefs.filter(r => !r.details?.level || r.details?.level === "asset_name");

  const [categoryId, setCategoryId] = useState(String(existing?.details?.categoryId || ""));
  const [subCategoryId, setSubCategoryId] = useState(String(existing?.details?.subCategoryId || ""));
  const [assetName, setAssetName] = useState(existing?.name || "");
  const [trackingType, setTrackingType] = useState(existing?.type || "Serialized");
  const [codeGroup, setCodeGroup] = useState(String(existing?.details?.codeGroup || ""));
  const [status, setStatus] = useState(existing?.status || "Active");
  
  const [inlineCreate, setInlineCreate] = useState<"category" | "subcategory" | "asset_name" | null>(null);
  const [feedback, setFeedback] = useState<{status: 'idle'|'loading'|'success'|'error', message: string}>({status: 'idle', message: ''});

  const availableSubs = subCategories.filter(s => s.parentId === categoryId || String(s.details?.categoryId) === categoryId);
  const availableAssetNames = assetTypes.filter(a => String(a.details?.subCategoryId) === subCategoryId || a.parentId === subCategoryId);
  
  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback({status: 'idle', message: ''});
    
    if (!assetName.trim()) {
      setFeedback({status: 'error', message: nl ? "Assetnaam is verplicht." : "Asset name is required."});
      return;
    }

    if (!isEditing) {
      const dup = assetTypes.find(a => a.name.toLowerCase().trim() === assetName.toLowerCase().trim() && String(a.details?.subCategoryId) === subCategoryId);
      if (dup) {
        setFeedback({status: 'error', message: nl ? "Deze assetnaam bestaat al in deze subcategorie." : "This asset name already exists in this sub-category."});
        return;
      }
    }
    
    setFeedback({status: 'loading', message: 'Saving...'});
    
    const details = {
      ...(existing?.details || {}),
      level: "asset_name",
      categoryId,
      subCategoryId,
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
        parentId: subCategoryId || categoryId || undefined
      }
    });

    if (!res.ok) {
      setFeedback({status: 'error', message: res.message});
    } else {
      setFeedback({status: 'success', message: 'Saved successfully.'});
      setTimeout(onClose, 300);
    }
  };

  const handleInlineCreated = (level: string, id: string, name: string) => {
    setInlineCreate(null);
    if (level === "category") {
      setCategoryId(id);
      setSubCategoryId("");
    } else if (level === "subcategory") {
      setSubCategoryId(id);
    } else if (level === "asset_name") {
      setAssetName(name);
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
            <Button variant="primary" onClick={(e) => {
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
                setInlineCreate("category");
                return;
              }
              setCategoryId(e.target.value);
              setSubCategoryId("");
            }}
          >
            <option value="">{nl ? "Selecteer categorie..." : "Select category..."}</option>
            {topCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__add__">{t("categories.addCategory")}</option>
          </SelectField>

          <SelectField
            label={t("categories.subCategory")}
            value={subCategoryId}
            required
            disabled={!categoryId}
            onChange={e => {
              if (e.target.value === "__add__") {
                setInlineCreate("subcategory");
                return;
              }
              setSubCategoryId(e.target.value);
            }}
          >
            <option value="">{nl ? "Selecteer subcategorie..." : "Select sub-category..."}</option>
            {availableSubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            {categoryId && <option value="__add__">{t("categories.addSubCategory")}</option>}
          </SelectField>

          {availableSubs.length === 0 && categoryId && (
            <div style={{fontSize: "0.85rem", color: "var(--color-neutral-text)", marginTop: "-10px", marginBottom: "15px"}}>
              {nl ? "Geen subcategorieën gevonden. " : "No sub-categories found. "}
              <a href="#" onClick={(e) => { e.preventDefault(); setInlineCreate("subcategory"); }}>{t("categories.addSubCategory")}</a>
            </div>
          )}

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
        <InlineCreateModal 
          level={inlineCreate} 
          categoryId={categoryId} 
          subCategoryId={subCategoryId}
          onClose={() => setInlineCreate(null)} 
          onSuccess={handleInlineCreated} 
        />
      )}
    </>
  );
};

const InlineCreateModal = ({ level, categoryId, subCategoryId, onClose, onSuccess }: { level: "category" | "subcategory" | "asset_name", categoryId: string, subCategoryId: string, onClose: () => void, onSuccess: (level: string, id: string, name: string) => void }) => {
  const { user, language } = useApp();
  const snapshot = useMockSnapshot();
  const repository = useRepository();
  const nl = language === "nl";
  const t = useT();

  const [name, setName] = useState("");
  const [feedback, setFeedback] = useState<{status: 'idle'|'loading'|'success'|'error', message: string}>({status: 'idle', message: ''});

  let title = "";
  if (level === "category") title = t("categories.addCategory");
  if (level === "subcategory") title = t("categories.addSubCategory");
  if (level === "asset_name") title = t("categories.addAssetName");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback({status: 'idle', message: ''});
    const trimmed = name.trim();
    if (!trimmed) {
      setFeedback({status: 'error', message: "Name is required."});
      return;
    }

    const allRefs = snapshot.references.filter(r => r.kind === "category");
    
    if (level === "category") {
      const dup = allRefs.find(r => r.details?.level === "category" && r.name.toLowerCase().trim() === trimmed.toLowerCase());
      if (dup) return setFeedback({status: 'error', message: nl ? "Deze categorie bestaat al." : "This category already exists."});
    } else if (level === "subcategory") {
      const dup = allRefs.find(r => r.details?.level === "subcategory" && String(r.details?.categoryId) === categoryId && r.name.toLowerCase().trim() === trimmed.toLowerCase());
      if (dup) return setFeedback({status: 'error', message: nl ? "Deze subcategorie bestaat al." : "This sub-category already exists."});
    } else if (level === "asset_name") {
      const dup = allRefs.find(r => (!r.details?.level || r.details?.level === "asset_name") && String(r.details?.subCategoryId) === subCategoryId && r.name.toLowerCase().trim() === trimmed.toLowerCase());
      if (dup) return setFeedback({status: 'error', message: nl ? "Deze assetnaam bestaat al." : "This asset name already exists."});
    }

    setFeedback({status: 'loading', message: 'Saving...'});

    const details: Record<string, any> = { level };
    if (level === "subcategory" || level === "asset_name") details.categoryId = categoryId;
    if (level === "asset_name") details.subCategoryId = subCategoryId;

    const res = await repository.execute({
      action: "reference.create",
      actor: user?.name || user?.email || "System",
      values: {
        kind: "category",
        name: trimmed,
        status: "Active",
        type: level === "asset_name" ? "Serialized" : "Hierarchy",
        details,
        parentId: level === "subcategory" ? categoryId : level === "asset_name" ? subCategoryId : undefined
      }
    });

    if (!res.ok) {
      setFeedback({status: 'error', message: res.message});
    } else {
      setFeedback({status: 'success', message: 'Saved successfully.'});
      // Mock repository returns ID implicitly via snapshot update, but execute does not return ID directly for reference.create.
      setTimeout(() => {
        const newlyAdded = snapshot.references.find(r => r.kind === "category" && r.name === trimmed && r.details?.level === level);
        onSuccess(level, newlyAdded?.id || String(Date.now()), trimmed);
      }, 500);
    }
  };

  return (
    <Dialog 
      open={true} 
      title={title} 
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
        
        {level === "subcategory" && (
          <div style={{marginBottom: "1rem"}}>
            <strong>{t("categories.category")}:</strong> {snapshot.references.find(r => r.id === categoryId)?.name}
          </div>
        )}

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

