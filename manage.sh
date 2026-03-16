#!/bin/bash

# Project Management Script with Optimized Options
# Usage: ./manage.sh [command]

function show_menu() {
    echo "=========================================="
    echo "   AI Static Analysis Project Manager     "
    echo "=========================================="
    echo "1) Start (Fast)    - Start without rebuilding"
    echo "2) Start (Rebuild) - Rebuild and start"
    echo "3) Build Only      - Just build the images"
    echo "4) Stop            - Stop and remove containers"
    echo "5) Status          - Check service status"
    echo "6) Logs            - Follow service logs"
    echo "7) Exit"
    echo "=========================================="
    read -p "Select an option [1-7]: " choice
    
    case $choice in
        1) run_cmd "start" ;;
        2) run_cmd "rebuild" ;;
        3) run_cmd "build" ;;
        4) run_cmd "stop" ;;
        5) run_cmd "status" ;;
        6) run_cmd "logs" ;;
        7) exit 0 ;;
        *) echo "Invalid option"; show_menu ;;
    esac
}

function run_cmd() {
    case "$1" in
        start)
            echo "Starting project services (Fast)..."
            docker compose up -d
            ;;
        rebuild)
            echo "Rebuilding and starting project services..."
            docker compose up -d --build
            ;;
        build)
            echo "Building images..."
            docker compose build
            ;;
        stop)
            echo "Stopping project services..."
            docker compose down
            ;;
        status)
            docker compose ps
            ;;
        logs)
            docker compose logs -f
            ;;
        *)
            echo "Unknown command: $1"
            echo "Usage: $0 {start|rebuild|build|stop|status|logs}"
            exit 1
            ;;
    esac
}

# If no argument is provided, show the interactive menu
if [ -z "$1" ]; then
    show_menu
else
    run_cmd "$1"
fi
