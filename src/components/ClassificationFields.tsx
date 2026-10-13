import React, { useState, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Plus } from "lucide-react";
import { useRepositorySnapshot, useRepository } from "../data/repositoryContext";
import { Button, Field } from "./ui";
import { Dialog, MutationFeedback } from "./WorkflowUi";
import { useAssetT } from "../assetCopy";
import { useApp } from "../context/AppContext";

export function ClassificationFields() {
  const { register, watch, setValue, formState: { errors } } = useFormContext();
  const snapshot = useRepositorySnapshot();
  const repository = useRepository();
  const a = useAssetT();
  const app = useApp();
  const nl = app.language === "nl";

  const currentCategory = watch("category");

  const [categorySearch, setCategorySearch] = useState("");
  
  const [isCategoryDropdownOpen, setCategoryDropdownOpen] = useState(false);

  const [addCategoryOpen, setAddCategoryOpen] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");

  const [categoryError, setCategoryError] = useState("");

  const categories = useMemo(() => {
    return (snapshot.references || [])
      .filter((ref) => ref.kind === "category" && ref.status === "Active")
      .map((ref) => ({
        id: ref.id,
        name: ref.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [snapshot.references]);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) =>
      c.name.toLowerCase().includes(categorySearch.toLowerCase())
    );
  }, [categories, categorySearch]);

  const handleCategorySelect = (name: string) => {
    setValue("category", name, { shouldValidate: true, shouldDirty: true });
    setValue("subcategory", "", { shouldValidate: true, shouldDirty: true });
    setCategoryDropdownOpen(false);
    setCategorySearch("");
  };

  const handleAddCategory = async () => {
    setCategoryError("");
    const normalizedName = newCategoryName.trim();
    if (!normalizedName) return;

    if (categories.some((c) => c.name.toLowerCase() === normalizedName.toLowerCase())) {
      setCategoryError(nl ? "Deze categorie bestaat al." : "This category already exists.");
      return;
    }

    try {
      const result = await repository.execute({
        action: "reference.create",
        values: { kind: "category", name: normalizedName, status: "Active" },
      });
      if (!result.ok) {
        setCategoryError(result.message);
        return;
      }
      handleCategorySelect(normalizedName);
      setAddCategoryOpen(false);
      setNewCategoryName("");
    } catch (err: any) {
      setCategoryError(err.message);
    }
  };

  return (
    <>
      <div
        className={`field-with-hint category-dropdown-field${isCategoryDropdownOpen ? " is-open" : ""}`}
        style={{ position: "relative", zIndex: isCategoryDropdownOpen ? 3 : "auto" }}
      >
        <label className="field" onMouseLeave={() => setCategoryDropdownOpen(false)}>
          <span>{a("category")} <b aria-hidden="true">*</b></span>
          <div className="dropdown-container">
            <div 
              className="dropdown-input" 
              onClick={() => setCategoryDropdownOpen(true)}
              style={{
                border: "1px solid var(--color-border)",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                wordBreak: "normal",
                minHeight: "40px",
                display: "flex",
                alignItems: "center"
              }}
            >
              {currentCategory || (nl ? "Categorie zoeken..." : "Search category...")}
            </div>
            {isCategoryDropdownOpen && (
              <div 
                className="asset-category-dropdown"
                style={{ 
                  position: "absolute", 
                  top: "100%", 
                  left: 0, 
                  right: 0, 
                  zIndex: 100, 
                  maxHeight: "300px", 
                  overflowY: "auto", 
                  display: "flex", 
                  flexDirection: "column", 
                  marginTop: "4px", 
                  background: "#ffffff", 
                  backgroundColor: "#ffffff", 
                  color: "#123b78", 
                  opacity: 1, 
                  backdropFilter: "none", 
                  WebkitBackdropFilter: "none", 
                  border: "1px solid var(--color-border, #cbd5e1)", 
                  borderRadius: "var(--radius-sm, 6px)", 
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" 
                }}
              >
                <div style={{ padding: "8px", borderBottom: "1px solid var(--color-border, #cbd5e1)", background: "#ffffff" }}>
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder={nl ? "Categorie zoeken..." : "Search category..."}
                    style={{ 
                      width: "100%", 
                      padding: "6px 8px", 
                      boxSizing: "border-box", 
                      background: "#ffffff", 
                      color: "#123b78", 
                      border: "1px solid var(--color-border, #cbd5e1)", 
                      borderRadius: "4px" 
                    }}
                    autoFocus
                  />
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, background: "#ffffff" }}>
                  {filteredCategories.map((c) => (
                    <li 
                      key={c.id} 
                      onClick={() => handleCategorySelect(c.name)}
                      style={{ 
                        padding: "8px 12px", 
                        cursor: "pointer", 
                        whiteSpace: "normal", 
                        overflowWrap: "anywhere", 
                        wordBreak: "normal", 
                        background: "#ffffff", 
                        color: "#123b78" 
                      }}
                      className="dropdown-item"
                    >
                      {c.name}
                    </li>
                  ))}
                  {filteredCategories.length === 0 && (
                    <li style={{ padding: "8px 12px", color: "var(--color-text-secondary, #64748b)", background: "#ffffff" }}>
                      {nl ? "Geen resultaten" : "No results"}
                    </li>
                  )}
                </ul>
                <div style={{ padding: "8px", borderTop: "1px solid var(--color-border, #cbd5e1)", background: "#ffffff" }}>
                  <Button type="button" variant="ghost" onClick={() => setAddCategoryOpen(true)} style={{ width: "100%", justifyContent: "flex-start", background: "#ffffff" }}>
                    <Plus size={16} /> {nl ? "Categorie toevoegen" : "Add category"}
                  </Button>
                </div>
              </div>
            )}
          </div>
          {errors.category?.message && <small className="field-error">{String(errors.category.message)}</small>}
        </label>
      </div>

      <Dialog 
        open={addCategoryOpen} 
        onClose={() => setAddCategoryOpen(false)} 
        title={nl ? "Categorie toevoegen" : "Add category"}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setAddCategoryOpen(false)}>{nl ? "Annuleren" : "Cancel"}</Button>
            <Button type="button" onClick={handleAddCategory}>{nl ? "Categorie toevoegen" : "Add category"}</Button>
          </>
        }
      >
        <Field
          label={nl ? "Naam categorie" : "Category name"}
          required
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          error={categoryError}
        />
        <Field
          label="Status"
          value="Active"
          disabled
        />
      </Dialog>

    </>
  );
}
