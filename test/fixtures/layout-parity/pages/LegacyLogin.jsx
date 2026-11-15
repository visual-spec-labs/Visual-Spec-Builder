// 과거 실패 형태의 재구성: 페이지 셸 없이 root가 h-full이다. 원본 AI TSX(SHA만 기록)가
// 아니며, 폰트·reset은 현재 계약과 같게 두어 셸 유무만 다르게 한다.
import { PageStyle } from "../PageShell";
import { LoginCard, loginRootClasses, Title } from "./LoginParts";

export default function LegacyLogin() {
  return (
    <>
      <PageStyle />
      <div data-node-id="root" className={`${loginRootClasses} w-full h-full`}>
        <Title />
        <LoginCard />
      </div>
    </>
  );
}
