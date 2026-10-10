// layout-parity.mjs --generated-dir가 Export 결과를 ./app에 복사한 뒤 이 틀로 띄운다.
// ?page=<page 티켓 componentName>이면 app/pages/<이름>.tsx(또는 .jsx)의 default export를 그린다.
import { createRoot } from "react-dom/client";

import "./app.css";
import { selectPageModule } from "./select-page.js";

const pages = import.meta.glob("./app/pages/*.{tsx,jsx}");
const name = new URLSearchParams(location.search).get("page");
const load = selectPageModule(pages, name);
if (!load) throw new Error(`app/pages/${name}.tsx가 없습니다.`);
const { default: Page } = await load();
createRoot(document.getElementById("root")).render(<Page />);
