import React, { useState, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { Search, Plus } from "lucide-react";
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
  const currentSubcategory = watch("subcategory");

  const [categorySearch, setCategorySearch] = useState("");
  const [subcategorySearch, setSubcategorySearch] = useState("");
  
  const [isCategoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [isSubcategoryDropdownOpen, setSubcategoryDropdownOpen] = useState(false);

  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [addSubcategoryOpen, setAddSubcategoryOpen] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");

  const [categoryError, setCategoryError] = useState("");
  const [subcategoryError, setSubcategoryError] = useState("");

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

  const subcategories = useMemo(() => {
    if (!currentCategory) return [];
    const categoryRecord = (snapshot.references || []).find(
      (ref) => ref.kind === "category" && ref.name === currentCategory
    );
    if (!categoryRecord) return [];

    return (snapshot.references || [])
      .filter(
        (ref) =>
          ref.kind === "subcategory" &&
          ref.status === "Active" &&
          (ref.parentId === categoryRecord.id || ref.parent === categoryRecord.name)
      )
      .map((ref) => ({ id: ref.id, name: ref.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [snapshot.references, currentCategory]);

  const filteredSubcategories = useMemo(() => {
    return subcategories.filter((s) =>
      s.name.toLowerCase().includes(subcategorySearch.toLowerCase())
    );
  }, [subcategories, subcategorySearch]);

  const handleCategorySelect = (name: string) => {
    setValue("category", name, { shouldValidate: true, shouldDirty: true });
    setValue("subcategory", "", { shouldValidate: true, shouldDirty: true });
    setCategoryDropdownOpen(false);
    setCategorySearch("");
  };

  const handleSubcategorySelect = (name: string) => {
    setValue("subcategory", name, { shouldValidate: true, shouldDirty: true });
    setSubcategoryDropdownOpen(false);
    setSubcategorySearch("");
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
      await repository.execute({
        action: "reference.create",
        values: { kind: "category", name: normalizedName, status: "Active" },
      });
      handleCategorySelect(normalizedName);
      setAddCategoryOpen(false);
      setNewCategoryName("");
    } catch (err: any) {
      setCategoryError(err.message);
    }
  };

  const handleAddSubcategory = async () => {
    setSubcategoryError("");
    const normalizedName = newSubcategoryName.trim();
    if (!normalizedName) return;

    if (subcategories.some((s) => s.name.toLowerCase() === normalizedName.toLowerCase())) {
      setSubcategoryError(nl ? "Deze subcategorie bestaat al." : "This subcategory already exists.");
      return;
    }

    const categoryRecord = (snapshot.references || []).find(
      (ref) => ref.kind === "category" && ref.name === currentCategory
    );

    if (!categoryRecord) {
      setSubcategoryError(nl ? "Selecteer eerst een categorie." : "Select a category first.");
      return;
    }

    try {
      await repository.execute({
        action: "reference.create",
        values: {
          kind: "subcategory",
          name: normalizedName,
          status: "Active",
          parentId: categoryRecord.id,
          parent: categoryRecord.name,
        },
      });
      handleSubcategorySelect(normalizedName);
      setAddSubcategoryOpen(false);
      setNewSubcategoryName("");
    } catch (err: any) {
      setSubcategoryError(err.message);
    }
  };

  return (
    <>
      <div className="field-with-hint" style={{ position: "relative" }}>
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
                className="dropdown-popover card" 
                style={{ 
                  position: "absolute", 
                  top: "100%", 
                  left: 0, 
                  right: 0, 
                  zIndex: 50, 
                  maxHeight: "300px", 
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  marginTop: "4px",
                  boxShadow: "var(--shadow-md)"
                }}
              >
                <div style={{ padding: "8px", borderBottom: "1px solid var(--color-border)" }}>
                  <input
                    type="text"
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    placeholder={nl ? "Categorie zoeken..." : "Search category..."}
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    autoFocus
                  />
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {filteredCategories.map((c) => (
                    <li 
                      key={c.id} 
                      onClick={() => handleCategorySelect(c.name)}
                      style={{ 
                        padding: "8px 12px", 
                        cursor: "pointer",
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                        wordBreak: "normal" 
                      }}
                      className="dropdown-item"
                    >
                      {c.name}
                    </li>
                  ))}
                  {filteredCategories.length === 0 && (
                    <li style={{ padding: "8px 12px", color: "var(--color-text-secondary)" }}>
                      {nl ? "Geen resultaten" : "No results"}
                    </li>
                  )}
                </ul>
                <div style={{ padding: "8px", borderTop: "1px solid var(--color-border)" }}>
                  <Button type="button" variant="ghost" onClick={() => setAddCategoryOpen(true)} style={{ width: "100%", justifyContent: "flex-start" }}>
                    <Plus size={16} /> {nl ? "Categorie toevoegen" : "Add category"}
                  </Button>
                </div>
              </div>
            )}
          </div>
          {errors.category?.message && <small className="field-error">{String(errors.category.message)}</small>}
        </label>
      </div>

      <div className="field-with-hint" style={{ position: "relative" }}>
        <label className="field" onMouseLeave={() => setSubcategoryDropdownOpen(false)}>
          <span>{a("subcategory")}</span>
          <div className="dropdown-container">
            <div 
              className="dropdown-input" 
              onClick={() => {
                if (!currentCategory) {
                  alert(nl ? "Selecteer eerst een categorie." : "Select a category first.");
                  return;
                }
                setSubcategoryDropdownOpen(true);
              }}
              style={{
                border: "1px solid var(--color-border)",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                cursor: currentCategory ? "pointer" : "not-allowed",
                opacity: currentCategory ? 1 : 0.6,
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                wordBreak: "normal",
                minHeight: "40px",
                display: "flex",
                alignItems: "center"
              }}
            >
              {currentSubcategory || (nl ? "Subcategorie zoeken..." : "Search sub-category...")}
            </div>
            {isSubcategoryDropdownOpen && currentCategory && (
              <div 
                className="dropdown-popover card" 
                style={{ 
                  position: "absolute", 
                  top: "100%", 
                  left: 0, 
                  right: 0, 
                  zIndex: 50, 
                  maxHeight: "300px", 
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  marginTop: "4px",
                  boxShadow: "var(--shadow-md)"
                }}
              >
                <div style={{ padding: "8px", borderBottom: "1px solid var(--color-border)" }}>
                  <input
                    type="text"
                    value={subcategorySearch}
                    onChange={(e) => setSubcategorySearch(e.target.value)}
                    placeholder={nl ? "Subcategorie zoeken..." : "Search sub-category..."}
                    style={{ width: "100%", padding: "6px", boxSizing: "border-box" }}
                    autoFocus
                  />
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {filteredSubcategories.map((s) => (
                    <li 
                      key={s.id} 
                      onClick={() => handleSubcategorySelect(s.name)}
                      style={{ 
                        padding: "8px 12px", 
                        cursor: "pointer",
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                        wordBreak: "normal" 
                      }}
                      className="dropdown-item"
                    >
                      {s.name}
                    </li>
                  ))}
                  {filteredSubcategories.length === 0 && (
                    <li style={{ padding: "8px 12px", color: "var(--color-text-secondary)" }}>
                      {nl ? "Geen resultaten" : "No results"}
                    </li>
                  )}
                </ul>
                <div style={{ padding: "8px", borderTop: "1px solid var(--color-border)" }}>
                  <Button type="button" variant="ghost" onClick={() => setAddSubcategoryOpen(true)} style={{ width: "100%", justifyContent: "flex-start" }}>
                    <Plus size={16} /> {nl ? "Subcategorie toevoegen" : "Add sub-category"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </label>
      </div>

      <Dialog 
        open={addCategoryOpen} 
        onClose={() => setAddCategoryOpen(false)} 
        title={nl ? "Categorie toevoegen" : "Add category"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddCategoryOpen(false)}>{nl ? "Annuleren" : "Cancel"}</Button>
            <Button onClick={handleAddCategory}>{nl ? "Categorie toevoegen" : "Add category"}</Button>
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

      <Dialog 
        open={addSubcategoryOpen} 
        onClose={() => setAddSubcategoryOpen(false)} 
        title={nl ? "Subcategorie toevoegen" : "Add sub-category"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddSubcategoryOpen(false)}>{nl ? "Annuleren" : "Cancel"}</Button>
            <Button onClick={handleAddSubcategory}>{nl ? "Subcategorie toevoegen" : "Add sub-category"}</Button>
          </>
        }
      >
        <Field
          label={nl ? "Categorie" : "Category"}
          value={currentCategory}
          disabled
        />
        <Field
          label={nl ? "Naam subcategorie" : "Sub-category name"}
          required
          value={newSubcategoryName}
          onChange={(e) => setNewSubcategoryName(e.target.value)}
          error={subcategoryError}
        />
      </Dialog>
    </>
  );
}
