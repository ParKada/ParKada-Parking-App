FROM python:3.10-slim

WORKDIR /app

# Install system dependencies required for OpenCV and Ultralytics
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install required Python packages for the tracking logic and API
RUN pip install --no-cache-dir \
    opencv-python-headless \
    numpy \
    ultralytics \
    supabase \
    python-dotenv \
    flask \
    flask-cors

# Copy the backend script, model, and environment variables
COPY smart_slots.py .
# If your best.pt is in the root directory, it will be copied. 
# If not present during build, Docker might complain unless we make it conditional or ensure it exists.
COPY best.pt .
COPY .env .

# Expose the Flask web streaming port
EXPOSE 5000

# Run the backend
CMD ["python", "smart_slots.py"]
