SHELL := /bin/bash

.PHONY: run run-backend run-frontend stop status open

run:
	@echo "Starting backend (http://localhost:8000) and frontend (http://localhost:5173)."
	@echo "Press Ctrl+C to stop both."
	@set -euo pipefail; \
	( cd backend && if [ -f .venv/bin/activate ]; then . .venv/bin/activate; fi && uvicorn app.main:app --reload --port 8000 ) & \
	( cd frontend && npm run dev ) & \
	wait

run-backend:
	@cd backend && if [ -f .venv/bin/activate ]; then . .venv/bin/activate; fi && uvicorn app.main:app --reload --port 8000

run-frontend:
	@cd frontend && npm run dev

stop:
	@set -euo pipefail; \
	stop_port() { \
		local port="$$1"; \
		local label="$$2"; \
		local pids=""; \
		if command -v lsof >/dev/null 2>&1; then \
			pids="$$(lsof -tiTCP:$$port -sTCP:LISTEN 2>/dev/null || true)"; \
		fi; \
		if [ -n "$$pids" ]; then \
			echo "Stopping $$label on port $$port (PID $$pids)."; \
			kill $$pids 2>/dev/null || true; \
		else \
			echo "No $$label listener on port $$port."; \
		fi; \
	}; \
	stop_port 8000 backend; \
	stop_port 5173 frontend

status:
	@set -euo pipefail; \
	check_port() { \
		local port="$$1"; \
		if command -v lsof >/dev/null 2>&1; then \
			lsof -tiTCP:$$port -sTCP:LISTEN >/dev/null 2>&1; \
			return $$?; \
		fi; \
		( echo > /dev/tcp/127.0.0.1/$$port ) >/dev/null 2>&1; \
		return $$?; \
	}; \
	backend=0; \
	frontend=0; \
	check_port 8000 && backend=1 || true; \
	check_port 5173 && frontend=1 || true; \
	if [ "$$backend" -eq 1 ] && [ "$$frontend" -eq 1 ]; then \
		status=RUNNING; \
	elif [ "$$backend" -eq 0 ] && [ "$$frontend" -eq 0 ]; then \
		status=STOPPED; \
	elif [ "$$backend" -ne "$$frontend" ]; then \
		status=DEGRADED; \
	else \
		status=UNKNOWN; \
	fi; \
	echo "STATUS=$$status"; \
	echo "BACKEND=$$([ "$$backend" -eq 1 ] && echo RUNNING || echo STOPPED)"; \
	echo "FRONTEND=$$([ "$$frontend" -eq 1 ] && echo RUNNING || echo STOPPED)"

open:
	@url="http://localhost:5173"; \
	if command -v open >/dev/null 2>&1; then \
		open "$$url"; \
	elif command -v xdg-open >/dev/null 2>&1; then \
		xdg-open "$$url"; \
	else \
		echo "No supported browser opener (open/xdg-open). Visit $$url manually."; \
	fi
