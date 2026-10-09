// #280 레이아웃 실측용 대상 앱. ?page=<이름>으로 페이지 하나를 그린다.
// pages/는 스킬 매핑을 사람이 옮긴 fixture이며 실제 AI 생성 결과가 아니다.
import { createRoot } from "react-dom/client";

import "./app.css";
import DashboardPage from "./pages/DashboardPage";
import ImageHeroPage from "./pages/ImageHeroPage";
import LegacyLogin from "./pages/LegacyLogin";
import Login from "./pages/Login";
import LongLogin from "./pages/LongLogin";
import ResponsiveCardsPage from "./pages/ResponsiveCardsPage";
import TwoPageLogin from "./pages/TwoPageLogin";

const pages = {
  "login-screen": Login,
  "login-legacy": LegacyLogin,
  "long-login": LongLogin,
  "image-hero": ImageHeroPage,
  "responsive-cards": ResponsiveCardsPage,
  "two-page-login": TwoPageLogin,
  "two-page-dashboard": DashboardPage,
};

const name = new URLSearchParams(location.search).get("page");
const Page = pages[name];
if (!Page) throw new Error(`알 수 없는 fixture 페이지: ${name}`);
createRoot(document.getElementById("root")).render(<Page />);
