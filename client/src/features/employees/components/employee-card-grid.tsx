import { usePaged, PaginationBar } from "@/components/shared/pagination";
import { EmployeeCard } from "./employee-ui";

/** Paged card grid for the directory. Owns its own page cursor. */
export function EmployeeCardGrid({ employees, departments, designations, selectionMode, selected, onToggle }: {
  employees: any[];
  departments: any[];
  designations: any[];
  selectionMode: boolean;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const paged = usePaged(employees);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {paged.pageItems.map((emp: any) => (
          <EmployeeCard
            key={emp.id}
            employee={emp}
            departments={departments}
            designations={designations}
            selectionMode={selectionMode}
            selected={selected.has(emp.id)}
            onToggle={() => onToggle(emp.id)}
          />
        ))}
      </div>
      <PaginationBar page={paged.page} totalPages={paged.totalPages} count={paged.count} size={paged.size} onPage={paged.setPage} />
    </div>
  );
}
