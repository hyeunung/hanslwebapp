import EmployeeMain from '@/components/employee/EmployeeMain';
import AppNavigationLayout from '@/components/layout/AppNavigationLayout';

export default function EmployeePage() {
  return (
    <AppNavigationLayout initialTab="employee">
      <EmployeeMain />
    </AppNavigationLayout>
  );
} 