const HR_ROLES = ["super_admin", "hr_admin", "hr_executive", "finance"];

export function sanitizeEmployeeForRole(
  emp: Record<string, any>,
  viewerRole: string,
  viewerEmployeeId?: string | null,
): Record<string, any> {
  if (HR_ROLES.includes(viewerRole)) {
    return emp;
  }

  if (viewerEmployeeId === emp.id) {
    const { panNumber, aadhaarMasked, bankAccountMasked, bankIfsc, ...rest } = emp;
    return rest;
  }

  return {
    id: emp.id,
    employeeCode: emp.employeeCode,
    firstName: emp.firstName,
    lastName: emp.lastName,
    email: emp.email,
    designationId: emp.designationId,
    departmentId: emp.departmentId,
    employmentStatus: emp.employmentStatus,
    employmentType: emp.employmentType,
    managerId: emp.managerId,
    workLocation: emp.workLocation,
    joinDate: emp.joinDate,
    profilePhoto: emp.profilePhoto,
    userId: emp.userId,
  };
}
