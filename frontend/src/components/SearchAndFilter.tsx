import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";

interface FilterOption {
  label: string;
  value: string;
}

interface SearchAndFilterProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  filters?: Array<{
    label: string;
    value: string;
    options: FilterOption[];
    onChange: (value: string) => void;
    placeholder?: string;
  }>;
  className?: string;
}

export const SearchAndFilter = ({
  searchPlaceholder = "Search...",
  searchValue,
  onSearchChange,
  filters = [],
  className = "",
}: SearchAndFilterProps) => {
  return (
    <Card className={`border-border/40 bg-card shadow-sm overflow-hidden rounded-md ${className}`}>
      <CardContent className="p-4 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:items-center gap-4">
          {/* Search Input */}
          <div className="space-y-2 flex-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Search
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 h-10 rounded-md bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Filter Dropdowns */}
          {filters.map((filter, index) => (
            <div key={index} className="space-y-2 flex-1">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {filter.label}
              </Label>
              <Select value={filter.value} onValueChange={filter.onChange}>
                <SelectTrigger className="w-full h-10 rounded-md bg-background border-border text-foreground">
                  <SelectValue placeholder={filter.placeholder || `Select ${filter.label}`} />
                </SelectTrigger>
                <SelectContent className="rounded-md">
                  {filter.options.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      className="text-foreground"
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
