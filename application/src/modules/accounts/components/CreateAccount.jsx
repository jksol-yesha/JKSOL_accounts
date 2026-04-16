import React, { useState, useMemo, useRef, useEffect } from "react";
import { cn } from "../../../utils/cn";
import {
  X,
  Save,
  Check,
  ChevronDown,
  Landmark,
  ListTree,
  Building2,
  Activity,
  FileText,
} from "lucide-react";
import CustomSelect from "../../../components/common/CustomSelect";
import apiService from "../../../services/api";
import { useOrganization } from "../../../context/OrganizationContext";
import {
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_SUBTYPE_LABELS,
  ACCOUNT_TYPES,
  ACCOUNT_SUBTYPES,
  SUBTYPE_GROUPS,
} from "../constants";
import { CURRENCY_OPTIONS } from "../../../utils/constants";

const formatDateForInput = (value) => {
  if (!value) return new Date().toISOString().split("T")[0];
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    return new Date().toISOString().split("T")[0];
  return parsed.toISOString().split("T")[0];
};

const shouldUseBankFields = (data) =>
  Number(data.accountType) === ACCOUNT_TYPES.ASSET &&
  Number(data.subtype) === ACCOUNT_SUBTYPES.BANK;

const clearAccountRelatedCaches = () => {
  if (typeof window === "undefined") return;

  const cachePrefixes = [
    "dashboard:rankings:",
    "dashboard:stats:",
    "accounts:",
  ];

  Object.keys(window.sessionStorage).forEach((key) => {
    if (cachePrefixes.some((prefix) => key.startsWith(prefix))) {
      window.sessionStorage.removeItem(key);
    }
  });
};

const ACCOUNTS_CREATE_SCROLL_MODE_EVENT = "accounts-create-scroll-mode";

const getInitialFormData = (account) => {
  if (!account) {
    return {
      name: "",
      accountType: ACCOUNT_TYPES.ASSET.toString(),
      subtype: "",
      currencyCode: "INR",
      accountNumber: "",
      accountHolderName: "",
      bankName: "",
      ifsc: "",
      swiftCode: "",
      bankBranchName: "",
      openingBalance: "0.00",
      openingBalanceDate: new Date().toISOString().split("T")[0],
      description: "",
      isActive: true,
    };
  }

  return {
    name: account.name || "",
    accountType:
      (
        account.accountType ??
        account.type ??
        ACCOUNT_TYPES.ASSET
      )?.toString() || ACCOUNT_TYPES.ASSET.toString(),
    subtype: (account.subtype ?? account.subType ?? "")?.toString() || "",
    currencyCode: account.currencyCode || account.baseCurrency || "INR",
    accountNumber: account.accountNumber || account.account_number || "",
    accountHolderName:
      account.accountHolderName || account.account_holder_name || "",
    bankName: account.bankName || account.bank_name || "",
    ifsc: account.ifsc || "",
    swiftCode: account.swiftCode || account.zipCode || account.zip_code || "",
    bankBranchName:
      account.bankBranchName ||
      account.bank_branch_name ||
      account.branchName ||
      "",
    openingBalance: account.openingBalance ?? "0.00",
    openingBalanceDate: formatDateForInput(account.openingBalanceDate),
    description: account.description || "",
    isActive:
      account.isActive !== undefined ? account.isActive : account.status === 1,
  };
};

const CreateAccount = ({ isOpen, onClose, accountToEdit, onSuccess }) => {
  const { selectedOrg } = useOrganization();
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  // Edit Mode
  const isEditMode = !!accountToEdit;
  const [formData, setFormData] = useState(() => getInitialFormData(null));

  // Reset state when drawer opens
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(getInitialFormData(accountToEdit));
      setErrors({});
      setShowSuccess(false);
    }
  }, [isOpen, accountToEdit]);

  // Handle lock scrolling globally when drawer opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "unset";
      };
    }
  }, [isOpen]);

  // Filtered Subtypes based on selected Type
  const filteredSubtypes = useMemo(() => {
    const typeId = parseInt(formData.accountType);
    const subtypeIds = SUBTYPE_GROUPS[typeId] || [];
    return subtypeIds.map((id) => ({
      id: id.toString(),
      label: ACCOUNT_SUBTYPE_LABELS[id],
    }));
  }, [formData.accountType]);

  const isAssetBank = shouldUseBankFields(formData);
  const fieldRefs = useRef({});

  const setFieldRef =
    (name, variant = "default") =>
    (el) => {
      if (!el) return;
      if (
        !fieldRefs.current[name] ||
        typeof fieldRefs.current[name]?.focus !== "function"
      ) {
        fieldRefs.current[name] = {};
      }
      fieldRefs.current[name][variant] = el;
    };

  const getNavigationRows = () => {
    const rows = [];
    rows.push(["name", "currencyCode"], ["accountType", "subtype"]);
    if (isAssetBank) {
      rows.push(["accountHolderName", "bankName"]);
      rows.push(["accountNumber", "ifsc"]);
      rows.push(["swiftCode", "bankBranchName"]);
    }
    rows.push(["openingBalance", "openingBalanceDate"]);
    rows.push(["description"]);
    rows.push(["isActive"]);
    return rows;
  };

  const focusField = (fieldName) => {
    if (!fieldName) return false;
    const refEntry = fieldRefs.current[fieldName];
    const candidates =
      refEntry && typeof refEntry.focus === "function"
        ? [refEntry]
        : [refEntry?.custom, refEntry?.native, refEntry?.default];

    const el = candidates.find((node) => {
      if (!node || node.disabled) return false;
      // Prefer visible/focusable element so hidden native/custom variants don't break nav.
      return node.offsetParent !== null || node.getClientRects?.().length > 0;
    });

    if (!el) return false;
    if (typeof el.focus === "function") el.focus();
    return true;
  };

  const focusNextLinear = (flatFields, startIndex, step) => {
    let i = startIndex + step;
    while (i >= 0 && i < flatFields.length) {
      if (focusField(flatFields[i])) return true;
      i += step;
    }
    return false;
  };

  const handleFieldKeyDown = (e, fieldName) => {
    const rows = getNavigationRows();
    const flatFields = rows.flat();
    const currentFlatIndex = flatFields.indexOf(fieldName);
    if (currentFlatIndex === -1) return;

    const rowIndex = rows.findIndex((r) => r.includes(fieldName));
    const colIndex = rowIndex >= 0 ? rows[rowIndex].indexOf(fieldName) : -1;

    if (e.key === "Enter") {
      e.preventDefault();
      const moved = focusNextLinear(flatFields, currentFlatIndex, 1);
      if (!moved) {
        // If there is no next focusable field, submit the form.
        e.currentTarget.form?.requestSubmit();
      }
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const target = rows[rowIndex]?.[colIndex + 1];
      if (!focusField(target)) {
        focusNextLinear(flatFields, currentFlatIndex, 1);
      }
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const target = rows[rowIndex]?.[colIndex - 1];
      if (!focusField(target)) {
        focusNextLinear(flatFields, currentFlatIndex, -1);
      }
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      let targetRow = rowIndex + step;

      while (targetRow >= 0 && targetRow < rows.length) {
        const target =
          rows[targetRow][Math.min(colIndex, rows[targetRow].length - 1)];
        if (focusField(target)) return;
        targetRow += step;
      }

      focusNextLinear(flatFields, currentFlatIndex, step);
    }
  };

  const validateField = (name, value, currentFormData = formData) => {
    let error = "";
    switch (name) {
      case "name":
        if (!value.trim()) error = "Required";
        break;
      case "accountType":
        if (!value) error = "Required";
        break;
      case "subtype":
        // Optional
        break;
      case "accountNumber":
        if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !String(value || "").trim()
        )
          error = "Required for Bank accounts";
        else if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !/^\d{6,20}$/.test(String(value || "").trim())
        )
          error = "Account No must be 6-20 digits";
        break;
      case "ifsc":
        if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !String(value || "").trim()
        )
          error = "Required for Bank accounts";
        else if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(
            String(value || "")
              .trim()
              .toUpperCase(),
          )
        )
          error = "Invalid IFSC format (e.g. HDFC0001234)";
        break;
      case "accountHolderName":
        if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !String(value || "").trim()
        )
          error = "Required for Bank accounts";
        else if (String(value || "").trim().length > 150)
          error = "Maximum 150 characters allowed";
        break;
      case "bankName":
        if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !String(value || "").trim()
        )
          error = "Required for Bank accounts";
        else if (String(value || "").trim().length > 150)
          error = "Maximum 150 characters allowed";
        break;
      case "swiftCode":
        if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !String(value || "").trim()
        )
          error = "Required for Bank accounts";
        else if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !/^[A-Z0-9]{8,11}$/.test(
            String(value || "")
              .trim()
              .toUpperCase(),
          )
        )
          error = "SWIFT Code must be 8-11 letters/numbers";
        break;
      case "bankBranchName":
        if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !String(value || "").trim()
        )
          error = "Required for Bank accounts";
        break;
      case "openingBalance":
        if (value === "" || value === null) error = "Required";
        else if (!/^\d+(\.\d{0,2})?$/.test(String(value).trim()))
          error = "Enter valid amount (up to 2 decimals)";
        break;
      case "openingBalanceDate":
        if (!value) error = "Required";
        break;
    }
    return error;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === "checkbox" ? checked : value;
    if (name === "ifsc" && typeof newValue === "string") {
      newValue = newValue.toUpperCase();
    }
    if (name === "swiftCode" && typeof newValue === "string") {
      newValue = newValue.toUpperCase();
    }
    if (name === "openingBalance" && typeof newValue === "string") {
      // Keep decimal input stable and prevent auto mutations from number-style parsing.
      let sanitized = newValue.replace(/,/g, "").replace(/[^\d.]/g, "");
      const firstDot = sanitized.indexOf(".");
      if (firstDot !== -1) {
        sanitized = `${sanitized.slice(0, firstDot + 1)}${sanitized.slice(firstDot + 1).replace(/\./g, "")}`;
      }
      newValue = sanitized;
    }

    let updatedData = { ...formData, [name]: newValue };

    if (name === "accountType") {
      updatedData.subtype = "";
    }

    if (!shouldUseBankFields(updatedData)) {
      updatedData.accountNumber = "";
      updatedData.accountHolderName = "";
      updatedData.bankName = "";
      updatedData.ifsc = "";
      updatedData.swiftCode = "";
      updatedData.bankBranchName = "";
    }

    setFormData(updatedData);

    const error = validateField(name, newValue, updatedData);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    const keysToValidate = isAssetBank
      ? Object.keys(formData)
      : Object.keys(formData).filter(
          (k) =>
            ![
              "accountNumber",
              "accountHolderName",
              "bankName",
              "ifsc",
              "swiftCode",
              "bankBranchName",
            ].includes(k),
        );
    keysToValidate.forEach((key) => {
      const err = validateField(key, formData[key]);
      if (err) newErrors[key] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      // Build base payload — openingBalance MUST be a string to satisfy backend schema
      const p = {
        ...formData,
        accountType: parseInt(formData.accountType),
        subtype:
          formData.subtype && formData.subtype !== "0"
            ? parseInt(formData.subtype)
            : null,
        openingBalance: String(formData.openingBalance ?? "0"),
      };

      if (isAssetBank) {
        p.accountNumber = formData.accountNumber || "";
        p.accountHolderName = formData.accountHolderName || "";
        p.bankName = formData.bankName || "";
        p.ifsc = formData.ifsc || "";
        p.zipCode = formData.swiftCode || "";
        p.bankBranchName = formData.bankBranchName || "";
      }

      if (isEditMode) {
        await apiService.accounts.update(accountToEdit.id, p);
      } else {
        await apiService.accounts.create(p, { orgId: selectedOrg?.id });
      }

      clearAccountRelatedCaches();

      setShowSuccess(true);
      if (onSuccess) onSuccess();

      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error("Save failed:", error);
      alert(
        "Failed to save: " + (error.response?.data?.message || error.message),
      );
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[110] animate-fade-in"
        onClick={onClose}
      ></div>

      {/* Sliding Drawer */}
      <div className="fixed inset-y-0 right-0 z-[120] w-full max-w-md bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.1)] flex flex-col animate-slide-in-right overflow-hidden">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col h-full bg-[#f8fafc]"
        >
          {/* Drawer Header */}
          <div className="flex flex-col px-5 py-2.5 border-b border-slate-100 bg-slate-50/50 shrink-0 shadow-sm relative z-10">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#4A8AF4]">
                  <Landmark size={14} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-[14px] font-extrabold text-slate-900 tracking-tight leading-tight">
                    {isEditMode ? "Edit Ledger Account" : "New Ledger Account"}
                  </h2>
                  <p className="text-[10px] font-semibold text-slate-500">
                    Chart of Accounts • Financial Statement Mapping
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-200 transition-colors focus:outline-none"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 no-scrollbar bg-white">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              {/* 1. Account Name */}
              <div className="space-y-1 col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block">
                  Account Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  ref={setFieldRef("name")}
                  value={formData.name}
                  onChange={handleChange}
                  onKeyDown={(e) => handleFieldKeyDown(e, "name")}
                  placeholder="e.g. Sales Revenue"
                  className={cn(
                    "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 placeholder:font-normal",
                    errors.name
                      ? "border-rose-500 focus:ring-rose-500/20"
                      : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                  )}
                  autoFocus
                />
                {errors.name && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-1 col-span-1">
                <label className="text-[11px] font-bold text-slate-600 block">
                  Base Currency
                </label>
                <CustomSelect
                  name="currencyCode"
                  ref={setFieldRef("currencyCode", "default")}
                  value={formData.currencyCode}
                  onChange={handleChange}
                  onKeyDown={(e) => handleFieldKeyDown(e, "currencyCode")}
                  isSearchable={true}
                  searchPlaceholder="Search currencies..."
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                >
                  {CURRENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </CustomSelect>
              </div>

              {/* 2. Type */}
              <div className="space-y-1 col-span-1">
                <label className="text-[11px] font-bold text-slate-600 block">
                  Account Type <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  name="accountType"
                  ref={setFieldRef("accountType", "default")}
                  value={formData.accountType}
                  onChange={handleChange}
                  onKeyDown={(e) => handleFieldKeyDown(e, "accountType")}
                  isSearchable={true}
                  searchPlaceholder="Search type..."
                  className={cn(
                    "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all",
                    errors.accountType
                      ? "border-rose-500"
                      : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                  )}
                >
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </CustomSelect>
                {errors.accountType && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                    {errors.accountType}
                  </p>
                )}
              </div>

              {/* 3. Subtype */}
              <div className="space-y-1 col-span-1">
                <label className="text-[11px] font-bold text-slate-600 block">
                  Subtype <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  name="subtype"
                  ref={setFieldRef("subtype", "default")}
                  value={formData.subtype}
                  onChange={handleChange}
                  onKeyDown={(e) => handleFieldKeyDown(e, "subtype")}
                  disabled={!formData.accountType}
                  isSearchable={true}
                  searchPlaceholder="Search subtype..."
                  className={cn(
                    "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all disabled:opacity-50 disabled:bg-slate-50",
                    errors.subtype
                      ? "border-rose-500"
                      : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                  )}
                >
                  <option value="">Select Category</option>
                  {filteredSubtypes.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.label}
                    </option>
                  ))}
                </CustomSelect>
                {errors.subtype && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                    {errors.subtype}
                  </p>
                )}
              </div>

              {/* Institution Mapping (Bank Details) */}
              {isAssetBank && (
                <>
                  <div className="space-y-1 col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      Account Holder Name{" "}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="accountHolderName"
                      ref={setFieldRef("accountHolderName")}
                      value={formData.accountHolderName}
                      onChange={handleChange}
                      onKeyDown={(e) =>
                        handleFieldKeyDown(e, "accountHolderName")
                      }
                      placeholder="As per bank records"
                      className={cn(
                        "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 placeholder:font-normal",
                        errors.accountHolderName
                          ? "border-rose-500 focus:ring-rose-500/20"
                          : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                      )}
                    />
                    {errors.accountHolderName && (
                      <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                        {errors.accountHolderName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 col-span-2">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      Bank Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="bankName"
                      ref={setFieldRef("bankName")}
                      value={formData.bankName}
                      onChange={handleChange}
                      onKeyDown={(e) => handleFieldKeyDown(e, "bankName")}
                      placeholder="Enter registered bank name"
                      className={cn(
                        "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 placeholder:font-normal",
                        errors.bankName
                          ? "border-rose-500 focus:ring-rose-500/20"
                          : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                      )}
                    />
                    {errors.bankName && (
                      <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                        {errors.bankName}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      Account Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="accountNumber"
                      ref={setFieldRef("accountNumber")}
                      value={formData.accountNumber}
                      onChange={handleChange}
                      onKeyDown={(e) => handleFieldKeyDown(e, "accountNumber")}
                      className={cn(
                        "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all",
                        errors.accountNumber
                          ? "border-rose-500 focus:ring-rose-500/20"
                          : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                      )}
                    />
                    {errors.accountNumber && (
                      <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                        {errors.accountNumber}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      IFSC Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="ifsc"
                      ref={setFieldRef("ifsc")}
                      value={formData.ifsc}
                      onChange={handleChange}
                      onKeyDown={(e) => handleFieldKeyDown(e, "ifsc")}
                      className={cn(
                        "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all uppercase",
                        errors.ifsc
                          ? "border-rose-500 focus:ring-rose-500/20"
                          : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                      )}
                    />
                    {errors.ifsc && (
                      <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                        {errors.ifsc}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      Swift Code <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="swiftCode"
                      ref={setFieldRef("swiftCode")}
                      value={formData.swiftCode}
                      onChange={handleChange}
                      onKeyDown={(e) => handleFieldKeyDown(e, "swiftCode")}
                      className={cn(
                        "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all uppercase",
                        errors.swiftCode
                          ? "border-rose-500 focus:ring-rose-500/20"
                          : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                      )}
                    />
                    {errors.swiftCode && (
                      <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                        {errors.swiftCode}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      Branch Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="bankBranchName"
                      ref={setFieldRef("bankBranchName")}
                      value={formData.bankBranchName}
                      onChange={handleChange}
                      onKeyDown={(e) => handleFieldKeyDown(e, "bankBranchName")}
                      className={cn(
                        "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all",
                        errors.bankBranchName
                          ? "border-rose-500 focus:ring-rose-500/20"
                          : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                      )}
                    />
                    {errors.bankBranchName && (
                      <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                        {errors.bankBranchName}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Financial Position */}
              <div className="space-y-1 col-span-1">
                <label className="text-[11px] font-bold text-slate-600 block">
                  Opening Balance <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[12px]">
                    {formData.currencyCode}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    name="openingBalance"
                    ref={setFieldRef("openingBalance")}
                    value={formData.openingBalance}
                    onChange={handleChange}
                    onKeyDown={(e) => handleFieldKeyDown(e, "openingBalance")}
                    placeholder="0.00"
                    className={cn(
                      "w-full pl-10 pr-3 py-1.5 bg-white border rounded-md text-[13px] font-bold text-emerald-600 shadow-sm outline-none transition-all",
                      errors.openingBalance
                        ? "border-rose-500 focus:ring-rose-500/20"
                        : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                    )}
                  />
                </div>
                {errors.openingBalance && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                    {errors.openingBalance}
                  </p>
                )}
              </div>

              <div className="space-y-1 col-span-1">
                <label className="text-[11px] font-bold text-slate-600 block">
                  As of Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  name="openingBalanceDate"
                  ref={setFieldRef("openingBalanceDate")}
                  value={formData.openingBalanceDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={handleChange}
                  onKeyDown={(e) => handleFieldKeyDown(e, "openingBalanceDate")}
                  className={cn(
                    "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all accounts-laptop-date-input",
                    errors.openingBalanceDate
                      ? "border-rose-500 focus:ring-rose-500/20"
                      : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                  )}
                />
                {errors.openingBalanceDate && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                    {errors.openingBalanceDate}
                  </p>
                )}
              </div>

              <div className="space-y-1 col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block">
                  Account Synopsis
                </label>
                <textarea
                  name="description"
                  ref={setFieldRef("description")}
                  value={formData.description}
                  onChange={handleChange}
                  onKeyDown={(e) => handleFieldKeyDown(e, "description")}
                  rows={2}
                  placeholder="Internal memo or description..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-md text-[13px] font-medium text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all resize-none placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="px-5 py-2.5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
            <label className="flex items-center gap-2 cursor-pointer group">
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  ref={setFieldRef("isActive")}
                  checked={formData.isActive}
                  onChange={handleChange}
                  onKeyDown={(e) => handleFieldKeyDown(e, "isActive")}
                  className="sr-only peer"
                />
                <div className="relative h-4 w-7 rounded-full bg-slate-200 shadow-inner transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-slate-300 peer-checked:bg-[#4A8AF4] before:absolute before:left-[2px] before:top-[2px] before:h-3 before:w-3 before:rounded-full before:bg-white before:shadow-sm before:transition-transform before:duration-200 peer-checked:before:translate-x-3"></div>
              </div>
              <span className="text-[11px] font-bold text-slate-600 select-none group-hover:text-slate-900 transition-colors">
                {formData.isActive ? "Active" : "Inactive"}
              </span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#4A8AF4] hover:bg-[#2F5FC6] text-white text-[11px] font-bold px-4 py-1.5 rounded-md shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Save size={13} strokeWidth={2.5} />
                <span>{isEditMode ? "Update" : "Save"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Success Popup */}
      {showSuccess && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center max-w-sm mx-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600">
              <Check size={32} strokeWidth={3} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {isEditMode ? "Account Updated" : "Account Created"}
            </h3>
            <p className="text-gray-500 text-center text-sm">Closing...</p>
          </div>
        </div>
      )}
    </>
  );
};

export default CreateAccount;
