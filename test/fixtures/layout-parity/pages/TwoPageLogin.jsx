// examples/two-page-project.json의 login 페이지(4노드).
import { PageShell } from "../PageShell";
import { cardClasses, Hint, loginRootClasses, Title } from "./LoginParts";

export default function TwoPageLogin() {
  return (
    <PageShell width="390px" height="844px">
      <div data-node-id="root" className={`${loginRootClasses} w-full flex-[1_0_auto]`}>
        <Title />
        <div data-node-id="card" className={cardClasses}>
          <Hint />
        </div>
      </div>
    </PageShell>
  );
}
