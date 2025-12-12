import setuptools


with open("README.md", "r") as f:
    long_description = f.read()

setuptools.setup(
    name="executor-contracts",
    description="Smart Contracts for Wormhole Executor on Algorand",
    author="Folks Finance",
    version="0.0.1",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/Folks-Finance/executor-contracts",
    license="Apache-2.0",
    project_urls={
        "Source": "https://github.com/Folks-Finance/executor-contracts",
    },
    install_requires=[
        "algokit>=2.9.1,<3",
        "algorand-python>=3.2.0,<4",
        "puyapy>=5.5.0,<6",
    ],
    packages=setuptools.find_packages(
        include=(
            "executor_contracts",
            "executor_contracts.*",
        )
    ),
    python_requires=">=3.12",
    package_data={"executor_contracts": ["py.typed"]},
    include_package_data=True
)
