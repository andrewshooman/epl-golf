from pathlib import Path


APP_DIR = Path(r"C:\Users\sushi\OneDrive\Desktop\epl-prediction-standings-app")
ENV_FILE = APP_DIR / ".env"
CONFIG_FILE = APP_DIR / "config.js"


def parse_env(text: str) -> dict:
    result = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip().strip('"').strip("'")
    return result


def main() -> None:
    if not ENV_FILE.exists():
        raise FileNotFoundError(f"Missing {ENV_FILE}. Create it from .env.example.")

    env = parse_env(ENV_FILE.read_text(encoding="utf-8"))
    api_key = env.get("FOOTBALL_DATA_API_KEY", "")
    CONFIG_FILE.write_text(
        "window.APP_CONFIG = {\n"
        f'  FOOTBALL_DATA_API_KEY: "{api_key}"\n'
        "};\n",
        encoding="utf-8",
    )
    print(f"Updated {CONFIG_FILE} from {ENV_FILE}")


if __name__ == "__main__":
    main()
