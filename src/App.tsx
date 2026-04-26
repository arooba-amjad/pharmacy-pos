import { LicenseCheckWrapper } from '@/components/license/LicenseCheckWrapper';
import { PosAppNavigator } from '@/navigation/PosAppNavigator';

function App() {
  return (
    <LicenseCheckWrapper>
      <PosAppNavigator />
    </LicenseCheckWrapper>
  );
}

export default App;
