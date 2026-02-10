# REST API Specification

Base URL: `http://localhost:3001`

## Endpoints

### GET /api/health

Health check endpoint.

**Response** `200 OK`
```json
{
  "status": "ok",
  "channels": 150
}
```

| Field | Type | Description |
|-------|------|-------------|
| status | string | Always `"ok"` |
| channels | number | Current number of channels in the playlist |

---

### GET /api/playlist

Returns the full playlist as JSON.

**Response** `200 OK`
```json
{
  "name": "My IPTV Playlist",
  "channels": [
    {
      "id": "a1b2c3d4",
      "name": "Channel One",
      "group": "Entertainment",
      "logo_url": "https://example.com/logo.png",
      "stream_url": "https://stream.example.com/live.m3u8",
      "is_live": true
    }
  ],
  "last_checked": "2024-01-15T10:30:00Z",
  "source": "https://example.com/playlist.m3u"
}
```

| Field | Type | Description |
|-------|------|-------------|
| name | string | Playlist display name |
| channels | Channel[] | Array of channel objects |
| last_checked | string \| null | ISO 8601 timestamp of last liveness check |
| source | string | Original M3U source URL |

#### Channel Object

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (hash of stream URL) |
| name | string | Channel display name |
| group | string | Category/group name |
| logo_url | string \| null | URL to channel logo |
| stream_url | string | HLS/MPEG-TS stream URL |
| is_live | boolean | Whether the channel is currently reachable |

---

### GET /api/playlist/m3u

Returns the playlist in M3U text format.

**Response** `200 OK`
- Content-Type: `audio/x-mpegurl`

```
#EXTM3U
#EXTINF:-1 tvg-name="Channel One" group-title="Entertainment" tvg-logo="https://example.com/logo.png",Channel One
https://stream.example.com/live.m3u8
```
