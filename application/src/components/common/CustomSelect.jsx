import React from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cn } from "../../utils/cn";
import { useOverlayStack } from "../../hooks/useOverlayStack";

const DEFAULT_MAX_VISIBLE_OPTIONS = 3;
const OPTION_ROW_HEIGHT = 36;

const normalizeLabel = (children, fallback) => {
  if (typeof children === "string" || typeof children === "number")
    return String(children);
  if (Array.isArray(children)) {
    const flat = children
      .map((item) =>
        typeof item === "string" || typeof item === "number"
          ? String(item)
          : "",
      )
      .join("")
      .trim();
    if (flat) return flat;
  }
  return fallback;
};

const CustomSelect = React.forwardRef(
  (
    {
      value,
      onChange,
      onFocusNext,
      children,
      className = "",
      buttonLabelClassName = "",
      dropdownClassName = "",
      dropdownContentClassName = "",
      optionLabelClassName = "",
      dropdownItemClassName = "",
      dropdownWidth,
      matchTriggerWidth = false,
      maxVisibleOptions = DEFAULT_MAX_VISIBLE_OPTIONS,
      optionRowHeight = OPTION_ROW_HEIGHT,
      disabled = false,
      required = false,
      name,
      dropdownGroup,
      onKeyDown,
      isSearchable = false,
      searchPlaceholder = "Search...",
      searchInInput = false,
      showSelectedCheck = true,
      showSelectedBackground = true,
      highlightSelectedOptionOnOpen = true,
      openOnArrowKeys = true,
      openOnFocus = true,
      placeholder = "Select",
      ...rest
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const selectId = React.useId();
    const wrapperRef = React.useRef(null);
    const buttonRef = React.useRef(null);
    const dropdownRef = React.useRef(null);
    const searchInputRef = React.useRef(null);
    const optionRefs = React.useRef([]);
    const [dropdownStyles, setDropdownStyles] = React.useState({});
    const [searchTerm, setSearchTerm] = React.useState("");
    const [triggerInputValue, setTriggerInputValue] = React.useState("");
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1);

    const options = React.useMemo(() => {
      const flatOptions = [];
      const processChildren = (children) => {
        React.Children.forEach(children, (child) => {
          if (!React.isValidElement(child)) return;
          if (child.type === React.Fragment) {
            processChildren(child.props.children);
          } else if (child.type === "option") {
            const optionValue = child.props.value ?? "";
            flatOptions.push({
              key: child.key ?? `${optionValue}-${flatOptions.length}`,
              value: String(optionValue),
              label: normalizeLabel(child.props.children, String(optionValue)),
              disabled: Boolean(child.props.disabled),
            });
          }
        });
      };
      processChildren(children);
      return flatOptions;
    }, [children]);

    const currentValue = String(value ?? "");
    const resolvedMaxVisibleOptions = Math.max(
      1,
      Number(maxVisibleOptions) || DEFAULT_MAX_VISIBLE_OPTIONS,
    );
    const resolvedOptionRowHeight = Math.max(
      20,
      Number(optionRowHeight) || OPTION_ROW_HEIGHT,
    );
    const optionListMaxHeight =
      resolvedMaxVisibleOptions * resolvedOptionRowHeight;
    const selectedOption = options.find(
      (option) => option.value === currentValue,
    );
    const fallbackOption = options.find((option) => option.value === "");
    const buttonLabel =
      selectedOption?.label || fallbackOption?.label || placeholder;
    const selectedLabel = selectedOption?.label || "";
    const usesEmptyValuePlaceholder =
      searchInInput &&
      currentValue === "" &&
      selectedOption?.value === "" &&
      Boolean(selectedLabel);
    const activeSearchTerm = searchInInput ? triggerInputValue : searchTerm;

    const filteredOptions = React.useMemo(() => {
      if (!isSearchable || !activeSearchTerm.trim()) return options;
      const term = activeSearchTerm.toLowerCase();
      const getMatchRank = (label) => {
        const normalizedLabel = label.toLowerCase();
        const matchIndex = normalizedLabel.indexOf(term);

        if (matchIndex === -1) return null;
        if (normalizedLabel === term) return [0, 0, label.length];
        if (normalizedLabel.startsWith(term)) return [1, 0, label.length];

        const segments = normalizedLabel
          .split(/[^a-z0-9]+/i)
          .filter(Boolean);

        if (segments.some((segment) => segment === term)) {
          return [2, matchIndex, label.length];
        }

        if (segments.some((segment) => segment.startsWith(term))) {
          return [3, matchIndex, label.length];
        }

        return [4, matchIndex, label.length];
      };

      return options
        .map((opt, index) => {
          const rank = getMatchRank(opt.label);
          return rank ? { opt, index, rank } : null;
        })
        .filter(Boolean)
        .sort((left, right) => {
          for (let idx = 0; idx < left.rank.length; idx += 1) {
            if (left.rank[idx] !== right.rank[idx]) {
              return left.rank[idx] - right.rank[idx];
            }
          }
          return left.index - right.index;
        })
        .map(({ opt }) => opt);
    }, [options, isSearchable, activeSearchTerm]);

    useOverlayStack(`dropdown-${selectId}`, isOpen, () => {
      setIsOpen(false);
      buttonRef.current?.focus();
    });

    React.useEffect(() => {
      if (!isOpen) {
        setSearchTerm("");
        setTriggerInputValue(selectedLabel);
        setHighlightedIndex(-1);
      } else {
        const idx = filteredOptions.findIndex((opt) => opt.value === currentValue);
        setHighlightedIndex(
          idx >= 0 ? (highlightSelectedOptionOnOpen ? idx : -1) : 0,
        );

        if (isSearchable && !searchInInput) {
          const timer = setTimeout(() => {
            searchInputRef.current?.focus();
          }, 50);
          return () => clearTimeout(timer);
        }
      }
    }, [isOpen, isSearchable, searchInInput, filteredOptions, currentValue, selectedLabel]);

    React.useEffect(() => {
      if (disabled && isOpen) setIsOpen(false);
    }, [disabled, isOpen]);

    React.useEffect(() => {
      if (!isOpen || highlightedIndex < 0) return;
      optionRefs.current[highlightedIndex]?.scrollIntoView?.({
        block: "nearest",
      });
    }, [highlightedIndex, isOpen]);

    const updatePosition = React.useCallback(() => {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const isMobile = window.innerWidth < 1024;
        const requestedWidth =
          typeof dropdownWidth === "number" && Number.isFinite(dropdownWidth)
            ? dropdownWidth
            : null;
        const baseEstimatedDropdownHeight =
          optionListMaxHeight +
          (isSearchable && !searchInInput ? 64 : 16);
        const estimatedDropdownHeight = Math.min(
          dropdownRef.current?.offsetHeight || baseEstimatedDropdownHeight,
          isMobile
            ? Math.round(window.innerHeight * 0.44)
            : baseEstimatedDropdownHeight,
        );
        const requiredSpace = estimatedDropdownHeight + 8;
        const showAbove = spaceBelow < requiredSpace && spaceAbove > spaceBelow;

        if (isMobile) {
          const viewportPadding = 12;
          const maxWidth = Math.max(
            140,
            window.innerWidth - viewportPadding * 2,
          );
          const width = requestedWidth
            ? Math.min(Math.max(requestedWidth, 140), maxWidth)
            : Math.min(
                Math.max(
                  matchTriggerWidth ? rect.width : Math.max(rect.width, 240),
                  140,
                ),
                maxWidth,
              );
          const left = Math.max(
            viewportPadding,
            Math.min(rect.left, window.innerWidth - width - viewportPadding),
          );

          setDropdownStyles({
            position: "fixed",
            left,
            ...(requestedWidth || matchTriggerWidth
              ? { width }
              : { minWidth: width }),
            maxWidth: maxWidth,
            ...(showAbove
              ? { bottom: window.innerHeight - rect.top + 4 }
              : { top: rect.bottom + 4 }),
          });
          return;
        }

        const viewportPadding = 16;
        const maxWidth = Math.max(140, window.innerWidth - viewportPadding * 2);
        const width = requestedWidth
          ? Math.min(Math.max(requestedWidth, 140), maxWidth)
          : rect.width;
        const left = Math.max(
          viewportPadding,
          Math.min(rect.left, window.innerWidth - width - viewportPadding),
        );

        setDropdownStyles({
          position: "fixed",
          left,
          ...(requestedWidth || matchTriggerWidth
            ? { width }
            : { minWidth: rect.width }),
          maxWidth: "calc(100vw - 32px)",
          ...(showAbove
            ? { bottom: window.innerHeight - rect.top + 4 }
            : { top: rect.bottom + 4 }),
        });
      }
    }, [
      dropdownWidth,
      isSearchable,
      matchTriggerWidth,
      optionListMaxHeight,
      searchInInput,
    ]);

    const openDropdown = React.useCallback(() => {
      if (disabled) return;
      if (usesEmptyValuePlaceholder) {
        setTriggerInputValue("");
        setSearchTerm("");
      }
      updatePosition();
      if (dropdownGroup) {
        document.dispatchEvent(
          new CustomEvent("custom-select:open", {
            detail: { id: selectId, group: dropdownGroup },
          }),
        );
      }
      setIsOpen(true);
    }, [
      disabled,
      dropdownGroup,
      selectId,
      updatePosition,
      usesEmptyValuePlaceholder,
    ]);

    React.useEffect(() => {
      const handleOutsideClick = (event) => {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
          if (
            dropdownRef.current &&
            dropdownRef.current.contains(event.target)
          ) {
            return;
          }
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("touchstart", handleOutsideClick);
      if (isOpen) {
        updatePosition();
        window.addEventListener("scroll", updatePosition, true);
        window.addEventListener("resize", updatePosition, true);
      }
      return () => {
        document.removeEventListener("mousedown", handleOutsideClick);
        document.removeEventListener("touchstart", handleOutsideClick);
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition, true);
      };
    }, [isOpen, updatePosition]);

    React.useEffect(() => {
      if (!dropdownGroup) return;

      const handleSelectOpen = (event) => {
        const detail = event.detail || {};
        if (detail.group === dropdownGroup && detail.id !== selectId) {
          setIsOpen(false);
        }
      };

      document.addEventListener("custom-select:open", handleSelectOpen);
      return () =>
        document.removeEventListener("custom-select:open", handleSelectOpen);
    }, [dropdownGroup, selectId]);

    const handleSelect = (nextValue) => {
      if (disabled) return;
      const nextOption = options.find(
        (option) => option.value === String(nextValue),
      );
      onChange?.({ target: { name, value: String(nextValue) } });
      if (searchInInput) {
        setTriggerInputValue(nextOption?.label || "");
      }
      setSearchTerm("");
      setIsOpen(false);
      setTimeout(() => {
        onFocusNext?.();
      }, 0);
    };

    const handleInternalKeyDown = (e) => {
      if (disabled) return;

      if (!isOpen) {
        if (e.shiftKey && (e.key === "Enter" || e.key === "Tab")) {
          onKeyDown?.(e);
          return;
        }

        if (
          e.key === "Enter" ||
          (openOnArrowKeys &&
            (e.key === "ArrowDown" || e.key === "ArrowUp"))
        ) {
          e.preventDefault();
          openDropdown();
        } else {
          onKeyDown?.(e);
        }
        return;
      }

      switch (e.key) {
        case "Tab": {
          if (filteredOptions.length === 0) {
            setIsOpen(false);
            onKeyDown?.(e);
            break;
          }
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value);
          } else {
            setIsOpen(false);
            setTimeout(() => {
              onFocusNext?.();
            }, 0);
          }
          break;
        }
        case "ArrowDown":
          if (filteredOptions.length === 0) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % filteredOptions.length);
          break;
        case "ArrowUp":
          if (filteredOptions.length === 0) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex].value);
          } else {
            setIsOpen(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          buttonRef.current?.focus();
          break;
        default:
          break;
      }
    };

    return (
      <div className="relative" ref={wrapperRef}>
        {required && (
          <input
            tabIndex={-1}
            aria-hidden="true"
            className="absolute h-0 w-0 opacity-0 pointer-events-none"
            name={name}
            value={currentValue}
            onChange={() => {}}
            required={required}
          />
        )}

        {searchInInput && isSearchable ? (
          <div className="relative">
            <input
              ref={(node) => {
                buttonRef.current = node;
                if (typeof ref === "function") ref(node);
                else if (ref) ref.current = node;
              }}
              type="text"
              role="combobox"
              aria-haspopup="listbox"
              aria-expanded={isOpen}
              aria-controls={`listbox-${selectId}`}
              data-custom-select-trigger="true"
              disabled={disabled}
              value={triggerInputValue}
              placeholder={searchPlaceholder}
              onFocus={(e) => {
                if (openOnFocus) {
                  openDropdown();
                }
                setSearchTerm("");
                if (e.target.value && typeof e.target.select === "function") {
                  setTimeout(() => e.target.select(), 0);
                }
              }}
              onClick={() => {
                if (!isOpen) {
                  openDropdown();
                }
              }}
              onChange={(e) => {
                const nextValue = e.target.value;
                if (!isOpen) {
                  openDropdown();
                }
                setTriggerInputValue(nextValue);
                setSearchTerm(nextValue);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleInternalKeyDown}
              autoComplete="off"
              title={triggerInputValue || selectedLabel || searchPlaceholder}
              {...rest}
              className={cn(
                className,
                "w-full px-3 pr-9 text-[12px] leading-tight",
                disabled ? "cursor-not-allowed opacity-75" : "cursor-text",
              )}
            />
            <svg
              className={cn(
                "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 transition-transform",
                isOpen ? "rotate-180" : "",
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </div>
        ) : (
          <button
            ref={(node) => {
              buttonRef.current = node;
              if (typeof ref === "function") ref(node);
              else if (ref) ref.current = node;
            }}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={`listbox-${selectId}`}
            data-custom-select-trigger="true"
            disabled={disabled}
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
                return;
              }
              openDropdown();
            }}
            onKeyDown={handleInternalKeyDown}
            {...rest}
            className={cn(
              className,
              "flex items-center justify-between text-left",
              disabled ? "cursor-not-allowed opacity-75" : "cursor-pointer",
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 truncate pr-3 text-[12px] leading-tight",
                buttonLabelClassName,
              )}
            >
              {buttonLabel.includes(" - ") ? (
                <>
                  <span className="font-bold text-[#4A8AF4] mr-1 opacity-90">
                    {buttonLabel.split(" - ")[0]}
                  </span>
                  <span>{buttonLabel.split(" - ").slice(1).join(" - ")}</span>
                </>
              ) : (
                buttonLabel
              )}
            </span>
            <svg
              className={cn(
                "h-4 w-4 shrink-0 text-gray-500 transition-transform",
                isOpen ? "rotate-180" : "",
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </button>
        )}

        {isOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={dropdownRef}
              id={`listbox-${selectId}`}
              role="listbox"
              data-custom-select-dropdown="true"
              style={dropdownStyles}
              className={cn(
                "z-[9999] bg-white border border-gray-100 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                dropdownClassName,
              )}
            >
              <div
                className={cn(
                  "p-0.5",
                )}
              >
                {isSearchable && !searchInInput && (
                  <div className="mb-0.5 border-b border-gray-50 bg-white px-1.5 py-1.5">
                    <div className="relative">
                      <input
                        ref={searchInputRef}
                        type="text"
                        className="w-full rounded-lg border border-gray-100 bg-gray-50 px-3 py-[5px] text-[12px] font-medium text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-[#4A8AF4]/40 focus:ring-2 focus:ring-[#4A8AF4]/5"
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={handleInternalKeyDown}
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSearchTerm("");
                            searchInputRef.current?.focus();
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.5"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    "overflow-y-auto custom-scrollbar",
                    dropdownContentClassName,
                  )}
                  style={{
                    maxHeight: `${optionListMaxHeight}px`,
                  }}
                >
                  {filteredOptions.length === 0 ? (
                    <div className="px-4 py-8 text-center" role="presentation">
                      <p className="text-[12px] font-medium text-slate-400">
                        No results found for "{activeSearchTerm}"
                      </p>
                    </div>
                  ) : (
                    filteredOptions.map((option, idx) => {
                    const isSelected = option.value === currentValue;
                    const isHighlighted = idx === highlightedIndex;
                    return (
                      <button
                        key={option.key}
                        ref={(node) => {
                          optionRefs.current[idx] = node;
                        }}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        disabled={option.disabled}
                        title={option.label}
                        onClick={() => handleSelect(option.value)}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded-[6px] px-2 py-1 text-left transition-colors",
                          option.disabled
                            ? "text-gray-300 cursor-not-allowed"
                            : isSelected
                              ? showSelectedBackground
                                ? "bg-[#EEF0FC]"
                                : "bg-transparent hover:bg-transparent"
                              : isHighlighted
                              ? "bg-[#EEF0FC]"
                              : "hover:bg-[#EEF0FC]",
                            dropdownItemClassName,
                        )}
                      >
                        <div className="w-4 flex justify-center shrink-0">
                          {showSelectedCheck && isSelected && (
                            <Check
                              size={14}
                              className="text-[#4A8AF4]"
                              strokeWidth={2.5}
                            />
                          )}
                        </div>
                        <span
                          className={cn(
                            "block w-full pr-1 text-[12px] leading-tight tracking-tight whitespace-normal break-words",
                            optionLabelClassName,
                          )}
                        >
                          {option.label.includes(" - ") ? (
                            <>
                              <span
                                className={cn(
                                  "font-bold mr-1",
                                  isSelected || isHighlighted
                                    ? "text-[#4A8AF4]"
                                    : "text-slate-400",
                                )}
                              >
                                {option.label.split(" - ")[0]}
                              </span>
                              <span
                                className={
                                  isSelected || isHighlighted
                                    ? "font-bold text-slate-900"
                                    : "font-medium text-slate-800"
                                }
                              >
                                {option.label.split(" - ").slice(1).join(" - ")}
                              </span>
                            </>
                          ) : (
                            <span
                              className={
                                isSelected || isHighlighted
                                  ? "font-bold text-slate-900"
                                  : "font-medium text-slate-800"
                              }
                            >
                                {option.label}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    );
  },
);

CustomSelect.displayName = "CustomSelect";

export default CustomSelect;
