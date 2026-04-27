import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";
import { cn } from "../../../utils/cn";
import {
  X,
  Save,
  Check,
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
import { useBranch } from "../../../context/BranchContext";
import { useOverlayStack } from "../../../hooks/useOverlayStack";
import { useCurrencyOptions } from "../../../hooks/useCurrencyOptions";
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
const ACCOUNT_DRAWER_CLOSE_ANIMATION_MS = 280;

const formatLocalizedNumber = (val, currencyCode) => {
  if (!val && val !== 0) return "";
  const raw = String(val).replace(/,/g, "");
  if (isNaN(raw)) return val;

  const [integerPart, decimalPart] = raw.split(".");
  const locale = currencyCode === "INR" ? "en-IN" : "en-US";

  const formattedInteger = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(integerPart || 0);

  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart.slice(0, 2)}`;
  }
  if (raw.endsWith(".")) {
    return `${formattedInteger}.`;
  }
  return formattedInteger;
};

const unformatNumber = (val) => String(val || "").replace(/,/g, "");

const DEFAULT_DASHBOARD_CURRENCY_CODE = "INR";
const DASHBOARD_CURRENCY_CODE_SET = new Set(
  CURRENCY_OPTIONS.map((option) => String(option.value || "").toUpperCase()),
);

const normalizeCurrencyCode = (value) =>
  String(value || "").trim().toUpperCase();

const buildCurrencySelectionFromCode = (
  currencyCode,
  availableCurrencyOptions = [],
) => {
  const normalizedCode = normalizeCurrencyCode(currencyCode);
  const matchedCurrency = availableCurrencyOptions.find(
    (option) =>
      normalizeCurrencyCode(option.code || option.value) === normalizedCode,
  );

  return {
    currencyCode: normalizedCode,
    currencyId: matchedCurrency
      ? String(matchedCurrency.id || matchedCurrency.value || "")
      : "",
  };
};

const resolvePreferredDashboardCurrencyCode = (...candidateCodes) => {
  for (const candidateCode of candidateCodes) {
    const normalizedCode = normalizeCurrencyCode(candidateCode);
    if (DASHBOARD_CURRENCY_CODE_SET.has(normalizedCode)) {
      return normalizedCode;
    }
  }

  return DEFAULT_DASHBOARD_CURRENCY_CODE;
};

const getInitialFormData = (account) => {
  if (!account) {
    return {
      name: "",
      accountType: "",
      subtype: "",
      branchId: "",
      currencyId: "",
      currencyCode: "INR",
      accountNumber: "",
      accountHolderName: "",
      bankName: "",
      ifsc: "",
      swiftCode: "",
      bankBranchName: "",
      openingBalance: "",
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
        account.account_type ??
        account.type ??
        ""
      )?.toString() || "",
    subtype: (account.subtype ?? account.subType ?? account.sub_type ?? "")?.toString() || "",
    branchId: (account.branchId || account.branch_id || "")?.toString() || "",
    currencyId: account.currencyId || account.currency_id || "",
    currencyCode: account.currencyCode || account.baseCurrency || "",
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
    openingBalance: account.openingBalance ?? account.opening_balance ?? "0.00",
    openingBalanceDate: formatDateForInput(account.openingBalanceDate || account.opening_balance_date),
    description: account.description || "",
    isActive:
      account.isActive !== undefined ? account.isActive : account.status === 1,
  };
};

const CreateAccount = ({
  isOpen,
  onClose,
  accountToEdit,
  existingAccounts = [],
  onSuccess,
}) => {
  const { selectedOrg } = useOrganization();
  const { branches, selectedBranchIds } = useBranch();
  const { currencyOptions } = useCurrencyOptions();
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState({});
  const [focusTick, setFocusTick] = useState(0);
  const [isNameSuggestionsOpen, setIsNameSuggestionsOpen] = useState(false);
  const [activeNameSuggestionIndex, setActiveNameSuggestionIndex] = useState(-1);
  const [shouldRenderDrawer, setShouldRenderDrawer] = useState(isOpen);
  const [isClosingDrawer, setIsClosingDrawer] = useState(false);

  // Edit Mode
  const isEditMode = Boolean(accountToEdit);
  const fieldRefs = useRef({});
  const triggeringElementRef = useRef(null);
  const pendingFocusFieldRef = useRef(null);
  const navigationRowsRef = useRef([]);
  const nameInputRef = useRef(null);
  const nameBlurTimerRef = useRef(null);
  const datePickerAdvanceOnEnterRef = useRef(false);
  const submitFormRef = useRef(async () => false);
  const closeAnimationTimerRef = useRef(null);
  const shouldRestoreFocusRef = useRef(false);

  useEffect(() => {
    let openStateTimer = null;

    if (isOpen) {
      if (closeAnimationTimerRef.current) {
        clearTimeout(closeAnimationTimerRef.current);
        closeAnimationTimerRef.current = null;
      }
      openStateTimer = setTimeout(() => {
        setShouldRenderDrawer(true);
        setIsClosingDrawer(false);
      }, 0);

      return () => {
        if (openStateTimer) {
          clearTimeout(openStateTimer);
        }
      };
    }

    if (!shouldRenderDrawer) {
      return;
    }

    openStateTimer = setTimeout(() => {
      setIsClosingDrawer(true);
    }, 0);

    closeAnimationTimerRef.current = setTimeout(() => {
      setShouldRenderDrawer(false);
      setIsClosingDrawer(false);
      closeAnimationTimerRef.current = null;

      if (
        shouldRestoreFocusRef.current &&
        triggeringElementRef.current &&
        typeof triggeringElementRef.current.focus === "function"
      ) {
        triggeringElementRef.current.focus();
      }
      shouldRestoreFocusRef.current = false;
    }, 0);

    return () => {
      if (openStateTimer) {
        clearTimeout(openStateTimer);
      }
      if (closeAnimationTimerRef.current) {
        clearTimeout(closeAnimationTimerRef.current);
        closeAnimationTimerRef.current = null;
      }
    };
  }, [isOpen, shouldRenderDrawer]);

  useEffect(() => {
    return () => {
      if (closeAnimationTimerRef.current) {
        clearTimeout(closeAnimationTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (document.activeElement && document.activeElement !== document.body) {
        triggeringElementRef.current = document.activeElement;
      }
    }
  }, [isOpen]);

  const handleClose = React.useCallback(() => {
    shouldRestoreFocusRef.current = true;
    onClose();
  }, [onClose]);

  useOverlayStack("account-sidebar", isOpen, handleClose);

  const [formData, setFormData] = useState(() => getInitialFormData(null));

  const nameSuggestions = useMemo(() => {
    const searchTerm = String(formData.name || "").trim().toLowerCase();
    if (!searchTerm) return [];

    const normalizedCurrentId = Number(accountToEdit?.id || 0);
    const seen = new Set();

    return existingAccounts
      .filter((account) => Number(account?.id || 0) !== normalizedCurrentId)
      .map((account) => {
        const accountName = String(account?.name || "").trim();
        const normalizedName = accountName.toLowerCase();
        return {
          id: account?.id,
          name: accountName,
          normalizedName,
          typeLabel:
            account?.typeLabel ||
            ACCOUNT_TYPE_LABELS[Number(account?.accountType)] ||
            "Account",
          subtypeLabel:
            account?.subtypeLabel ||
            ACCOUNT_SUBTYPE_LABELS[Number(account?.subtype)] ||
            "",
        };
      })
      .filter((account) => account.name && account.normalizedName.includes(searchTerm))
      .filter((account) => {
        if (seen.has(account.normalizedName)) return false;
        seen.add(account.normalizedName);
        return true;
      })
      .sort((left, right) => {
        const leftStartsWith = left.normalizedName.startsWith(searchTerm);
        const rightStartsWith = right.normalizedName.startsWith(searchTerm);

        if (leftStartsWith !== rightStartsWith) {
          return leftStartsWith ? -1 : 1;
        }

        if (left.name.length !== right.name.length) {
          return left.name.length - right.name.length;
        }

        return left.name.localeCompare(right.name);
      })
      .slice(0, 6);
  }, [accountToEdit?.id, existingAccounts, formData.name]);

  const normalizedActiveNameSuggestionIndex =
    !isNameSuggestionsOpen || nameSuggestions.length === 0
      ? -1
      : Math.min(activeNameSuggestionIndex, nameSuggestions.length - 1);

  useEffect(() => {
    return () => {
      if (nameBlurTimerRef.current) {
        clearTimeout(nameBlurTimerRef.current);
      }
    };
  }, []);

  // Auto-select initial data for new accounts
  useEffect(() => {
    if (isOpen && !isEditMode && selectedOrg && (currencyOptions.length > 0 || branches.length > 0)) {
      setFormData(prev => {
        const updates = {};

        const validBranchIds = new Set(branches.map((branch) => String(branch.id)));

        // Default Branch
        let activeBranchId =
          prev.branchId && validBranchIds.has(String(prev.branchId))
            ? String(prev.branchId)
            : "";

        if (!activeBranchId && branches.length > 0) {
          const preferredBranchId = selectedBranchIds.find((id) =>
            validBranchIds.has(String(id)),
          );
          activeBranchId = String(preferredBranchId || branches[0].id || "");
        }

        if (String(prev.branchId || "") !== activeBranchId) {
          updates.branchId = activeBranchId;
        }

        const selectedBranch = branches.find(
          (branch) => String(branch.id) === activeBranchId,
        );
        const resolvedCurrencyCode = resolvePreferredDashboardCurrencyCode(
          selectedBranch?.currencyCode,
          selectedOrg?.baseCurrency,
          prev.currencyCode,
        );
        const nextCurrencySelection = buildCurrencySelectionFromCode(
          resolvedCurrencyCode,
          currencyOptions,
        );

        if (String(prev.currencyCode || "") !== nextCurrencySelection.currencyCode) {
          updates.currencyCode = nextCurrencySelection.currencyCode;
        }

        if (String(prev.currencyId || "") !== nextCurrencySelection.currencyId) {
          updates.currencyId = nextCurrencySelection.currencyId;
        }

        return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
      });
    }
  }, [isOpen, isEditMode, selectedOrg, currencyOptions, branches, selectedBranchIds]);

  // Reset state when drawer opens
  useEffect(() => {
    if (isOpen) {
      const initial = getInitialFormData(accountToEdit);
      
      // If editing and we have currencyOptions, ensure ID is mapped if missing
      if (
        accountToEdit &&
        currencyOptions.length > 0 &&
        !initial.currencyId &&
        initial.currencyCode
      ) {
        const mappedCurrency = buildCurrencySelectionFromCode(
          initial.currencyCode,
          currencyOptions,
        );
        if (mappedCurrency.currencyId) {
          initial.currencyId = mappedCurrency.currencyId;
        }
      }

      setFormData(initial);
      setErrors({});
      setShowSuccess(false);
      setIsNameSuggestionsOpen(false);
      setActiveNameSuggestionIndex(-1);
    }
  }, [isOpen, accountToEdit, currencyOptions]);

  // Handle lock scrolling globally when drawer opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      
      const handleGlobalKeyDown = (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          void submitFormRef.current?.();
        }

        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          handleClose();
          return;
        }

        if (e.key === "Tab") {
          // Allow natural tab behavior within the sidebar
          return;
        }
      };
      
      window.addEventListener("keydown", handleGlobalKeyDown);
      return () => {
        document.body.style.overflow = "unset";
        window.removeEventListener("keydown", handleGlobalKeyDown);
      };
    }
  }, [isOpen]);

  const focusField = (name, variant = "default") => {
    if (!name) return false;
    const refEntry = fieldRefs.current[name];
    if (!refEntry) return false;

    // Handle both direct refs and variant-mapped refs
    const el = (typeof refEntry.focus === "function") 
      ? refEntry 
      : (refEntry[variant] || refEntry.default || refEntry.native || refEntry.custom);

    if (el && typeof el.focus === "function") {
      el.focus();
      // Smart auto-selection for text/number/generic inputs
      if (typeof el.select === "function" && (!el.type || ["text", "number", "tel", "email"].includes(el.type))) {
        el.select();
      }
      return true;
    }
    return false;
  };

  // Unified Focus Logic for Dynamic Render Cycles
  useLayoutEffect(() => {
    if (isOpen && pendingFocusFieldRef.current) {
      const fieldToFocus = pendingFocusFieldRef.current;
      pendingFocusFieldRef.current = null;
      
      // Delay slightly to ensure browser has processed the new DOM elements
      const timer = setTimeout(() => {
        focusField(fieldToFocus);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, formData.subtype, formData.accountType, focusTick]);

  const getIsForexForFormData = (data) => {
    if (!data?.branchId || branches.length === 0) return false;
    const branch = branches.find(
      (candidate) => String(candidate.id) === String(data.branchId),
    );
    return Boolean(
      branch?.currencyCode &&
        String(branch.currencyCode).toUpperCase() !== "INR",
    );
  };

  const isForex = useMemo(() => {
    if (!formData.branchId || branches.length === 0) return false;
    const branch = branches.find(b => String(b.id) === String(formData.branchId));
    return branch?.currencyCode && branch.currencyCode !== 'INR';
  }, [formData.branchId, branches]);

  const isAssetBank = shouldUseBankFields(formData);

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
    rows.push(["name"]);
    rows.push(["branchId", "currencyId"]);
    rows.push(["accountType", "subtype"]);
    if (isAssetBank) {
      rows.push(["accountHolderName"]);
      rows.push(["bankName"]);
      rows.push(["accountNumber", "ifsc"]);
      rows.push(["swiftCode", "bankBranchName"]);
    }
    rows.push(["openingBalance", "openingBalanceDate"]);
    rows.push(["description"]);
    return rows;
  };

  useLayoutEffect(() => {
    navigationRowsRef.current = getNavigationRows();
  }, [isAssetBank]);

  const focusNextLinear = (currentFieldName, step = 1) => {
    const flatFields = navigationRowsRef.current.flat();
    const currentIndex = flatFields.indexOf(currentFieldName);
    if (currentIndex === -1) return false;

    let i = currentIndex + step;
    while (i >= 0 && i < flatFields.length) {
      if (focusField(flatFields[i])) return true;
      i += step;
    }
    return false;
  };

  const restoreDateInputFocus = (input) => {
    if (!input || input.disabled || input.readOnly) return;

    if (typeof input.blur === "function") {
      input.blur();
    }

    setTimeout(() => {
      if (typeof input.focus === "function") {
        input.focus({ preventScroll: true });
      }
    }, 0);
  };

  const handleFieldKeyDown = (e, fieldName) => {
    const rows =
      navigationRowsRef.current.length > 0
        ? navigationRowsRef.current
        : getNavigationRows();
    const flatFields = rows.flat();
    const currentFlatIndex = flatFields.indexOf(fieldName);

    if (currentFlatIndex === -1) {
      if (e.key === "Enter" && fieldName === "isActive") {
        e.preventDefault();
        void submitForm();
      }
      return;
    }

    const rowIndex = rows.findIndex((r) => r.includes(fieldName));
    const colIndex = rowIndex >= 0 ? rows[rowIndex].indexOf(fieldName) : -1;

    if (e.target.type === "date") {
      if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        if (datePickerAdvanceOnEnterRef.current) {
          const moved = focusNextLinear(fieldName, 1);
          if (!moved) {
            void submitForm();
          }
          datePickerAdvanceOnEnterRef.current = false;
        } else {
          e.target.showPicker?.();
          datePickerAdvanceOnEnterRef.current = true;
        }
        return;
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        return;
      }
    }
    if (e.key === "Tab") {
      if (e.shiftKey) {
        e.preventDefault();
        focusNextLinear(fieldName, -1);
        return;
      }
    }

    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      // If we are in a dropdown that is currently closed, it will open itself (handled in CustomSelect)
      // If we are in a normal input, move focus to the next field.
      const isDropdown =
        (e.target.closest('[role="combobox"]') ||
          e.target.closest('[data-custom-select-trigger="true"]')) &&
        e.target.type !== "date";

      if (isDropdown) {
        // Let Enter or Tab bubble to the CustomSelect to trigger opening
        return;
      }

      e.preventDefault();
      const moved = focusNextLinear(fieldName, 1);
      if (!moved) {
        void submitForm();
      }
      return;
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const target = rows[rowIndex]?.[colIndex + 1];
      if (!focusField(target)) {
        focusNextLinear(fieldName, 1);
      }
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const target = rows[rowIndex]?.[colIndex - 1];
      if (!focusField(target)) {
        focusNextLinear(fieldName, -1);
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

      focusNextLinear(fieldName, step);
    }
  };

  const validateField = (name, value, currentFormData = formData) => {
    let error = "";
    const fieldIsForex = getIsForexForFormData(currentFormData);

    switch (name) {
      case "name":
        if (!value.trim()) error = "Required";
        break;
      case "branchId":
        if (!String(value || "").trim()) {
          error = "Required";
        } else if (
          branches.length > 0 &&
          !branches.some((branch) => String(branch.id) === String(value))
        ) {
          error = "Select a valid office branch";
        }
        break;
      case "accountType":
        if (!value) error = "Required";
        break;
      case "subtype":
        if (!String(value || "").trim()) error = "Required";
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
          !fieldIsForex &&
          !String(value || "").trim()
        )
          error = "IFSC is required for Indian bank accounts";
        else if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !fieldIsForex &&
          !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(
            String(value || "")
              .trim()
              .toUpperCase(),
          )
        )
          error = "Invalid IFSC format (e.g. HDFC0001234)";
        else if (
          fieldIsForex &&
          String(value || "").trim() &&
          String(value || "").trim().length < 8
        ) {
          error = "Invalid IBAN (too short)";
        }
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
          !fieldIsForex &&
          !String(value || "").trim()
        )
          error = "SWIFT/BIC code is required for Indian bank accounts";
        else if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !fieldIsForex &&
          !/^[A-Z0-9]{8,11}$/.test(
            String(value || "")
              .trim()
              .toUpperCase(),
          )
        )
          error = "SWIFT Code must be 8-11 letters/numbers";
        else if (
          fieldIsForex &&
          String(value || "").trim() &&
          String(value || "").trim().length < 3
        ) {
           error = "Invalid NIC (too short)";
        }
        break;
      case "bankBranchName":
        if (
          Number(currentFormData.accountType) === ACCOUNT_TYPES.ASSET &&
          Number(currentFormData.subtype) === ACCOUNT_SUBTYPES.BANK &&
          !String(value || "").trim()
        )
          error = "Bank Branch Name is required";
        break;
      case "openingBalance": {
        const rawVal = unformatNumber(value);
        if (rawVal.trim() === "") {
          error = "Required";
        } else if (!/^\d+(\.\d{0,2})?$/.test(rawVal.trim())) {
          error = "Enter valid amount (up to 2 decimals)";
        }
        break;
      }
      case "openingBalanceDate":
        if (!value) error = "Required";
        break;
    }
    return error;
  };

  const applyNameSuggestion = (suggestionName) => {
    setFormData((prev) => ({ ...prev, name: suggestionName }));
    setErrors((prev) => ({
      ...prev,
      name: validateField("name", suggestionName, { ...formData, name: suggestionName }),
    }));
    setIsNameSuggestionsOpen(false);
    setActiveNameSuggestionIndex(-1);

    setTimeout(() => {
      if (nameInputRef.current && typeof nameInputRef.current.focus === "function") {
        nameInputRef.current.focus();
        const nextCursorPosition = suggestionName.length;
        if (typeof nameInputRef.current.setSelectionRange === "function") {
          nameInputRef.current.setSelectionRange(
            nextCursorPosition,
            nextCursorPosition,
          );
        }
      }
    }, 0);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === "checkbox" ? checked : value;
    if (name === "openingBalanceDate") {
      // We removed restoreDateInputFocus(input) to allow smooth segment navigation via arrow keys
      datePickerAdvanceOnEnterRef.current = true;
    }
    if (name === "ifsc" && typeof newValue === "string") {
      newValue = newValue.toUpperCase();
    }
    if (name === "swiftCode" && typeof newValue === "string") {
      newValue = newValue.toUpperCase();
    }
    if (name === "openingBalance" && typeof newValue === "string") {
      const cursor = e.target.selectionStart;
      const oldVal = e.target.value;

      // Clean input
      let sanitized = newValue.replace(/[^0-9.]/g, "");
      const firstDot = sanitized.indexOf(".");
      if (firstDot !== -1) {
        sanitized = `${sanitized.slice(0, firstDot + 1)}${sanitized.slice(firstDot + 1).replace(/\./g, "")}`;
      }

      // Format
      const formatted = formatLocalizedNumber(sanitized, formData.currencyCode);
      newValue = formatted;

      // Adjust cursor
      setTimeout(() => {
        if (e.target) {
          const newTag = e.target;
          const oldCommasPrev = (oldVal.slice(0, cursor).match(/,/g) || []).length;
          const newCommasPrev = (formatted.slice(0, cursor).match(/,/g) || []).length;
          const diff = newCommasPrev - oldCommasPrev;
          const newPos = Math.max(0, cursor + diff);
          if (newTag.setSelectionRange) {
            newTag.setSelectionRange(newPos, newPos);
          }
        }
      }, 0);
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

    // Auto-select Currency based on Branch
    if (name === "branchId" && newValue && branches.length > 0) {
      const selectedBranch = branches.find(
        (branch) => String(branch.id) === String(newValue),
      );
      const resolvedCurrencyCode = resolvePreferredDashboardCurrencyCode(
        selectedBranch?.currencyCode,
        selectedOrg?.baseCurrency,
        updatedData.currencyCode,
      );
      const nextCurrencySelection = buildCurrencySelectionFromCode(
        resolvedCurrencyCode,
        currencyOptions,
      );

      updatedData.currencyId = nextCurrencySelection.currencyId;
      updatedData.currencyCode = nextCurrencySelection.currencyCode;
    }

    setFormData(updatedData);

    if (name === "name") {
      setIsNameSuggestionsOpen(Boolean(String(newValue || "").trim()));
      setActiveNameSuggestionIndex(-1);
    }

    const error = validateField(name, newValue, updatedData);
    setErrors((prev) => ({ ...prev, [name]: error }));
  };

  const validateForm = () => {
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

    const firstInvalidField = keysToValidate.find((key) => newErrors[key]);
    return { newErrors, firstInvalidField };
  };

  const submitForm = async () => {
    const { newErrors, firstInvalidField } = validateForm();

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      if (firstInvalidField) {
        setTimeout(() => {
          focusField(firstInvalidField);
        }, 0);
      }
      return false;
    }

    try {
      // Build base payload — openingBalance MUST be a string to satisfy backend schema
      const p = {
        ...formData,
        accountType: parseInt(formData.accountType),
        account_type: parseInt(formData.accountType),
        subtype:
          formData.subtype && formData.subtype !== "0"
            ? parseInt(formData.subtype)
            : null,
        sub_type:
          formData.subtype && formData.subtype !== "0"
            ? parseInt(formData.subtype)
            : null,
        openingBalance: unformatNumber(formData.openingBalance) || "0",
        opening_balance: unformatNumber(formData.openingBalance) || "0",
        openingBalanceDate: formData.openingBalanceDate,
        opening_balance_date: formData.openingBalanceDate,
        currency_id: formData.currencyId ? parseInt(formData.currencyId) : null,
        branchId: formData.branchId ? parseInt(formData.branchId) : null,
      };

      // Ensure currency_id is present if only Code is available (fallback)
      if (!p.currency_id && formData.currencyCode && currencyOptions.length > 0) {
        const match = currencyOptions.find(opt => opt.code === formData.currencyCode);
        if (match) p.currency_id = parseInt(match.id || match.value);
      }

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
      return true;
    } catch (error) {
      console.error("Save failed:", error);
      alert(
        "Failed to save: " + (error.response?.data?.message || error.message),
      );
      return false;
    }
  };

  useEffect(() => {
    submitFormRef.current = submitForm;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await submitForm();
  };

  if (!shouldRenderDrawer) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[110]"
        )}
        onClick={handleClose}
      ></div>

      {/* Sliding Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-[120] w-full max-w-md bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden"
        )}
      >
        <form
          onSubmit={handleSubmit}
          noValidate
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
                onClick={handleClose}
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
                <div className="relative">
                  <input
                    type="text"
                    name="name"
                    ref={(el) => {
                      setFieldRef("name")(el);
                      nameInputRef.current = el;
                    }}
                    value={formData.name}
                    onChange={handleChange}
                    onFocus={() => {
                      if (nameSuggestions.length > 0) {
                        setIsNameSuggestionsOpen(true);
                      }
                    }}
                    onBlur={() => {
                      if (nameBlurTimerRef.current) {
                        clearTimeout(nameBlurTimerRef.current);
                      }
                      nameBlurTimerRef.current = setTimeout(() => {
                        setIsNameSuggestionsOpen(false);
                        setActiveNameSuggestionIndex(-1);
                      }, 120);
                    }}
                    onKeyDown={(e) => {
                      if (isNameSuggestionsOpen && nameSuggestions.length > 0) {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setActiveNameSuggestionIndex((prev) =>
                            prev < nameSuggestions.length - 1 ? prev + 1 : 0,
                          );
                          return;
                        }

                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setActiveNameSuggestionIndex((prev) =>
                            prev > 0 ? prev - 1 : nameSuggestions.length - 1,
                          );
                          return;
                        }

                        if (e.key === "Escape") {
                          e.preventDefault();
                          setIsNameSuggestionsOpen(false);
                          setActiveNameSuggestionIndex(-1);
                          return;
                        }

                        if (
                          e.key === "Enter" &&
                          normalizedActiveNameSuggestionIndex >= 0 &&
                          nameSuggestions[normalizedActiveNameSuggestionIndex]
                        ) {
                          e.preventDefault();
                          applyNameSuggestion(
                            nameSuggestions[normalizedActiveNameSuggestionIndex].name,
                          );
                          return;
                        }
                      }

                      handleFieldKeyDown(e, "name");
                    }}
                    placeholder="e.g. Sales Revenue"
                    className={cn(
                      "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 placeholder:font-normal",
                      errors.name
                        ? "border-rose-500 focus:ring-rose-500/20"
                        : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                    )}
                    autoFocus
                    autoComplete="off"
                  />
                  {isNameSuggestionsOpen && nameSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.12)]">
                      <div className="max-h-56 overflow-y-auto py-1">
                        {nameSuggestions.map((suggestion, index) => {
                          const isActive = index === normalizedActiveNameSuggestionIndex;
                          const metaLabel = [
                            suggestion.typeLabel,
                            suggestion.subtypeLabel,
                          ]
                            .filter(Boolean)
                            .join(" • ");

                          return (
                            <button
                              key={`${suggestion.id || suggestion.name}-${index}`}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                if (nameBlurTimerRef.current) {
                                  clearTimeout(nameBlurTimerRef.current);
                                }
                                applyNameSuggestion(suggestion.name);
                              }}
                              onMouseEnter={() => setActiveNameSuggestionIndex(index)}
                              className={cn(
                                "flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors",
                                isActive ? "bg-[#EEF0FC]" : "hover:bg-slate-50",
                              )}
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-[12px] font-semibold text-slate-800">
                                  {suggestion.name}
                                </span>
                                {metaLabel && (
                                  <span className="block truncate text-[10px] font-medium text-slate-400">
                                    {metaLabel}
                                  </span>
                                )}
                              </span>
                              <span className="pt-0.5 text-[10px] font-bold uppercase tracking-wide text-[#4A8AF4]">
                                Use
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
                {errors.name && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Branch */}
              <div className="space-y-1 col-span-1">
                <label className="text-[11px] font-bold text-slate-600 block">
                  Branch <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  name="branchId"
                  ref={setFieldRef("branchId", "default")}
                  value={formData.branchId}
                  onChange={handleChange}
                  onFocusNext={() => {
                    pendingFocusFieldRef.current = "currencyId";
                    setFocusTick(t => t + 1);
                  }}
                  onKeyDown={(e) => handleFieldKeyDown(e, "branchId")}
                  isSearchable={true}
                  searchInInput={true}
                  searchPlaceholder="Search branches..."
                  matchTriggerWidth={true}
                  maxVisibleOptions={4}
                  optionRowHeight={24}
                  className={cn(
                    "w-full truncate px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all",
                    errors.branchId
                      ? "border-rose-500 focus:ring-rose-500/20"
                      : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                  )}
                  optionLabelClassName="truncate whitespace-nowrap"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </CustomSelect>
                {errors.branchId && (
                  <p className="text-[10px] font-bold text-rose-500 mt-0.5">
                    {errors.branchId}
                  </p>
                )}
              </div>

              {/* Currency */}
              <div className="space-y-1 col-span-1">
                <label className="text-[11px] font-bold text-slate-600 block">
                  Base Currency
                </label>
                <CustomSelect
                  name="currencyId"
                  ref={setFieldRef("currencyId", "default")}
                  value={formData.currencyCode || DEFAULT_DASHBOARD_CURRENCY_CODE}
                  onChange={(e) => {
                    const nextCurrencySelection = buildCurrencySelectionFromCode(
                      e.target.value,
                      currencyOptions,
                    );
                    setFormData(prev => ({
                      ...prev,
                      currencyId: nextCurrencySelection.currencyId,
                      currencyCode:
                        nextCurrencySelection.currencyCode || prev.currencyCode,
                    }));
                  }}
                  onFocusNext={() => {
                    pendingFocusFieldRef.current = "accountType";
                    setFocusTick(t => t + 1);
                  }}
                  onKeyDown={(e) => handleFieldKeyDown(e, "currencyId")}
                  matchTriggerWidth={true}
                  maxVisibleOptions={4}
                  optionRowHeight={24}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all"
                  buttonLabelClassName="text-[12px] leading-tight font-semibold text-slate-800"
                >
                  {CURRENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value}
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
                  onFocusNext={() => {
                    pendingFocusFieldRef.current = "subtype";
                    setFocusTick(t => t + 1);
                  }}
                  onKeyDown={(e) => handleFieldKeyDown(e, "accountType")}
                  isSearchable={true}
                  searchInInput={true}
                  searchPlaceholder="Search type..."
                  matchTriggerWidth={true}
                  maxVisibleOptions={4}
                  optionRowHeight={24}
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
                  onFocusNext={() => {
                    // Logic to jump to dynamic fields if they appear
                    const nextFields = navigationRowsRef.current.flat();
                    const currentIndex = nextFields.indexOf("subtype");
                    
                    // We check if the NEW state (which should be in the DOM now via Render)
                    // has bank fields. If so, move to accountHolderName.
                    if (shouldUseBankFields(formData)) {
                      pendingFocusFieldRef.current = "accountHolderName";
                    } else {
                      const targetField = nextFields[currentIndex + 1];
                      if (targetField) {
                        pendingFocusFieldRef.current = targetField;
                      }
                    }
                    setFocusTick(t => t + 1);
                  }}
                  onKeyDown={(e) => handleFieldKeyDown(e, "subtype")}
                  disabled={!formData.accountType}
                  isSearchable={true}
                  searchInInput={true}
                  searchPlaceholder="Search subtype..."
                  matchTriggerWidth={true}
                  maxVisibleOptions={4}
                  optionRowHeight={24}
                  className={cn(
                    "w-full px-3 py-1.5 bg-white border rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none transition-all",
                    errors.subtype
                      ? "border-rose-500"
                      : "border-slate-200 focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10",
                  )}
                >
                  {(SUBTYPE_GROUPS[formData.accountType] || []).map((id) => (
                    <option key={id} value={id}>
                      {ACCOUNT_SUBTYPE_LABELS[id]}
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
                      {isForex ? "IBAN" : "IFSC"} {!isForex && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="text"
                      name="ifsc"
                      ref={setFieldRef("ifsc")}
                      value={formData.ifsc}
                      onChange={handleChange}
                      onKeyDown={(e) => handleFieldKeyDown(e, "ifsc")}
                      placeholder={isForex ? "Enter IBAN" : "HDFC0001234"}
                      className={cn(
                        "w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all uppercase",
                        errors.ifsc && "border-rose-500",
                      )}
                    />
                    {errors.ifsc && (
                      <p className="text-[10px] text-rose-500 mt-1 font-medium pl-1">
                        {errors.ifsc}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      {isForex ? "NIC Code" : "SWIFT/BIC Code"} {!isForex && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="text"
                      name="swiftCode"
                      ref={setFieldRef("swiftCode")}
                      value={formData.swiftCode}
                      onChange={handleChange}
                      onKeyDown={(e) => handleFieldKeyDown(e, "swiftCode")}
                      placeholder={isForex ? "Enter NIC Code" : "HDFCCINBBXXX"}
                      className={cn(
                        "w-full px-3 py-1.5 bg-white border border-slate-200 rounded-md text-[13px] font-semibold text-slate-800 shadow-sm outline-none focus:border-[#4A8AF4] focus:ring-2 focus:ring-[#4A8AF4]/10 transition-all uppercase",
                        errors.swiftCode && "border-rose-500",
                      )}
                    />
                    {errors.swiftCode && (
                      <p className="text-[10px] text-rose-500 mt-1 font-medium pl-1">
                        {errors.swiftCode}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 col-span-1">
                    <label className="text-[11px] font-bold text-slate-600 block">
                      Bank Branch Name <span className="text-rose-500">*</span>
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
                  onClick={(e) => {
                    // We only call restoreDateInputFocus on initial click to ensure focus is clean
                    // but we allow subsequent interactions to be native
                    restoreDateInputFocus(e.currentTarget);
                    e.currentTarget.showPicker?.();
                    datePickerAdvanceOnEnterRef.current = true;
                  }}
                  onBlur={() => {
                    datePickerAdvanceOnEnterRef.current = false;
                  }}
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
                  tabIndex={-1}
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
                ref={setFieldRef("cancel")}
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 rounded-md text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all outline-none focus:ring-2 focus:ring-slate-200"
              >
                Cancel
              </button>
              <button
                ref={setFieldRef("save")}
                type="submit"
                className="bg-[#4A8AF4] hover:bg-[#2F5FC6] text-white text-[11px] font-bold px-4 py-1.5 rounded-md shadow-sm active:scale-95 transition-all flex items-center gap-1.5 outline-none focus:ring-2 focus:ring-[#4A8AF4]/30"
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
