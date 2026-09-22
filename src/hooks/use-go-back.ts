import { useNavigate } from "react-router-dom";

/**
 * 返回上一页；没有可退的历史时（例如用户直接打开详情页深链接）退回 fallback。
 *
 * react-router v6 会在 history.state.idx 里维护当前条目索引，
 * 比 window.history.length 可靠——后者在整个标签页生命周期里都会一直大于 1。
 */
const useGoBack = (fallback = "/") => {
  const navigate = useNavigate();

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    const canGoBack = typeof idx === "number" ? idx > 0 : window.history.length > 1;
    if (canGoBack) navigate(-1);
    else navigate(fallback, { replace: true });
  };

  return goBack;
};

export default useGoBack;
