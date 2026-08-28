# Production domain compatibility

The canonical production origin is `https://novelty-engine.com`. New website, Skill, MCP, health, research API, metadata, sitemap, and documentation references use the apex origin.

The previously published aliases `https://www.novelty-engine.com` and `https://novelty-engine.vercel.app` must remain compatible at the DNS, hosting, or reverse-proxy layer. This repository does not add an application-level redirect because remote MCP clients send `POST` requests and a redirect can change method or body handling in some clients.

Before deployment, the operator must verify that both aliases terminate TLS correctly and forward MCP `POST /api/mcp` requests without dropping the request body, changing the method, or exposing credentials. This task intentionally did not deploy or alter external domain configuration.
