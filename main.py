from fastapi import FastAPI, Request
from pydantic import BaseModel
import yaml
from fastapi.staticfiles import StaticFiles

app = FastAPI()

class Block(BaseModel):
    id: str
    type: str
    data: dict
    position: dict

class Edge(BaseModel):
    source: str
    target: str

class Pipeline(BaseModel):
    blocks: list[Block]
    edges: list[Edge]

@app.post("/generate-yaml")
async def generate_yaml(pipeline: Pipeline):
    stages = []
    jobs = {}

    for block in pipeline.blocks:
        block_type = block.type
        if block_type not in stages:
            stages.append(block_type)
        jobs[block.id] = {
            'stage': block_type,
            'script': f'echo {block_type}'
        }

    for edge in pipeline.edges:
        if 'needs' not in jobs[edge.target]:
            jobs[edge.target]['needs'] = []
        jobs[edge.target]['needs'].append(edge.source)

    pipeline_dict = {'stages': stages, 'jobs': jobs}
    yaml_str = yaml.dump(pipeline_dict, sort_keys=False)
    return {"yaml": yaml_str}

app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

# Run the app with: uvicorn main:app --reload