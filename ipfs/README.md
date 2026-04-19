# IPFS Node - EHR File Storage

Node IPFS (Kubo) để lưu file y tế (X-quang, MRI, PDF) ngoài blockchain.

## Start

```bash
cd ipfs
docker compose up -d
```

## Check

```bash
# Gateway
curl http://localhost:8088/ipfs/bafkreib7oyyw... 

# API
curl -X POST "http://localhost:5001/api/v0/version"
```

## CORS (để frontend gọi trực tiếp nếu cần)

Mặc định backend proxy qua port 5000 nên **không cần** CORS. Nếu muốn frontend upload trực tiếp:

```bash
docker exec ehr-ipfs ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://localhost:3000"]'
docker exec ehr-ipfs ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["POST", "GET"]'
docker compose restart ipfs
```

## Pin file đã upload

```bash
# Liệt kê pin
docker exec ehr-ipfs ipfs pin ls

# Pin thủ công 1 CID
docker exec ehr-ipfs ipfs pin add <CID>
```

## Shutdown

```bash
docker compose down

# Xóa data
rm -rf ./ipfs-data ./ipfs-staging
```

## Ports

| Port | Dùng cho |
|------|----------|
| 4001 | P2P swarm (peer discovery) |
| 5001 | HTTP API (backend dùng) |
| 8088 | HTTP gateway (preview) |
