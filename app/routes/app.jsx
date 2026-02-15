import { Outlet, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as AppBridgeProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisProvider } from "@shopify/polaris"; // [ĐỔI TÊN ĐỂ TRÁNH TRÙNG]
import translations from "@shopify/polaris/locales/en.json"; // [QUAN TRỌNG: THÊM DÒNG NÀY]
import "@shopify/polaris/build/esm/styles.css"; // [QUAN TRỌNG: ĐẢM BẢO CÓ CSS]
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppBridgeProvider embedded apiKey={apiKey}>
      {/* Bao bọc toàn bộ app bằng PolarisProvider và truyền translations */}
      <PolarisProvider i18n={translations}>
        <ui-nav-menu>
          <a href="/app" rel="home">Home</a>
          <a href="/app/additional">Additional page</a>
        </ui-nav-menu>
        <Outlet />
      </PolarisProvider>
    </AppBridgeProvider>
  );
}

// ... giữ nguyên phần ErrorBoundary và headers bên dưới