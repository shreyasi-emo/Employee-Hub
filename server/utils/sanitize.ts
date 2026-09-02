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

  // A manager sees a fuller — but still non-sensitive — view of their OWN direct reports (phone +
  // basic personal, for the My Team drawer). Never salary / PAN / Aadhaar / bank.
  if (viewerRole === "manager" && emp.managerId && emp.managerId === viewerEmployeeId) {
    return {
      id: emp.id, employeeCode: emp.employeeCode, firstName: emp.firstName, lastName: emp.lastName,
      email: emp.email, phone: emp.phone, designationId: emp.designationId, departmentId: emp.departmentId,
      employmentStatus: emp.employmentStatus, employmentType: emp.employmentType, managerId: emp.managerId,
      workLocation: emp.workLocation, joinDate: emp.joinDate, profilePhoto: emp.profilePhoto, avatarUrl: emp.avatarUrl,
      dateOfBirth: emp.dateOfBirth, gender: emp.gender, maritalStatus: emp.maritalStatus, bloodGroup: emp.bloodGroup,
      userId: emp.userId,
    };
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
