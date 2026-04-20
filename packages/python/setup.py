"""
OpenRouter Auto - Python SDK
Auto-configure and use any OpenRouter model with zero setup
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="openrouter-auto",
    version="1.0.0",
    author="faraz152",
    description="Auto-configure and use any OpenRouter model with zero setup",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/faraz152/openrouter-auto-connect",
    project_urls={
        "Bug Tracker": "https://github.com/faraz152/openrouter-auto-connect/issues",
        "Source Code": "https://github.com/faraz152/openrouter-auto-connect/tree/main/packages/python",
    },
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.8",
    install_requires=[
        "httpx>=0.24.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
            "black>=23.0.0",
            "mypy>=1.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "openrouter-auto=openrouter_auto.cli:main",
        ],
    },
)
