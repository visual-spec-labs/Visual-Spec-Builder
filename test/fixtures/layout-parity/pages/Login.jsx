import { PageShell } from "../PageShell";
import { LoginCard, loginRootClasses, Title } from "./LoginParts";

export default function Login() {
  return (
    <PageShell width="390px" height="844px">
      <div data-node-id="root" className={`${loginRootClasses} w-full flex-[1_0_auto]`}>
        <Title />
        <LoginCard />
      </div>
    </PageShell>
  );
}
