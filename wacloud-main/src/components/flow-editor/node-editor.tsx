'use client'

import { Node } from '@xyflow/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NodeEditorProps {
  node: Node | null
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onDelete: (nodeId: string) => void
}

export function NodeEditor({ node, onUpdate, onDelete }: NodeEditorProps) {
  if (!node) {
    return (
      <div className="w-72 border-l bg-card p-4 flex items-center justify-center text-center">
        <div className="text-muted-foreground">
          <p className="font-medium">No node selected</p>
          <p className="text-sm">Click a node to edit its properties</p>
        </div>
      </div>
    )
  }

  const handleChange = (key: string, value: unknown) => {
    onUpdate(node.id, { [key]: value })
  }

  return (
    <div className="w-72 border-l bg-card p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Edit {node.type}</h3>
        {node.type !== 'start' && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => onDelete(node.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {/* Common: Label */}
        <div className="space-y-2">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            value={(node.data.label as string) || ''}
            onChange={(e) => handleChange('label', e.target.value)}
            placeholder="Node label"
          />
        </div>

        {/* Message Node */}
        {node.type === 'message' && (
          <div className="space-y-2">
            <Label htmlFor="content">Message Content</Label>
            <Textarea
              id="content"
              value={(node.data.content as string) || ''}
              onChange={(e) => handleChange('content', e.target.value)}
              placeholder="Enter your message..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Use {'{{name}}'} for personalization
            </p>
          </div>
        )}

        {/* Question Node */}
        {node.type === 'question' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Textarea
                id="question"
                value={(node.data.question as string) || ''}
                onChange={(e) => handleChange('question', e.target.value)}
                placeholder="What would you like to ask?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Response Type</Label>
              <Select
                value={(node.data.responseType as string) || 'text'}
                onValueChange={(value) => handleChange('responseType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Free Text</SelectItem>
                  <SelectItem value="buttons">Buttons</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="variable">Save to Variable</Label>
              <Input
                id="variable"
                value={(node.data.variable as string) || ''}
                onChange={(e) => handleChange('variable', e.target.value)}
                placeholder="e.g., user_response"
              />
            </div>
          </>
        )}

        {/* Condition Node */}
        {node.type === 'condition' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="variable">Variable</Label>
              <Input
                id="variable"
                value={(node.data.variable as string) || ''}
                onChange={(e) => handleChange('variable', e.target.value)}
                placeholder="e.g., user_response"
              />
            </div>
            <div className="space-y-2">
              <Label>Operator</Label>
              <Select
                value={(node.data.operator as string) || 'equals'}
                onValueChange={(value) => handleChange('operator', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Equals</SelectItem>
                  <SelectItem value="not_equals">Not Equals</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="starts_with">Starts With</SelectItem>
                  <SelectItem value="ends_with">Ends With</SelectItem>
                  <SelectItem value="greater_than">Greater Than</SelectItem>
                  <SelectItem value="less_than">Less Than</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                value={(node.data.value as string) || ''}
                onChange={(e) => handleChange('value', e.target.value)}
                placeholder="Comparison value"
              />
            </div>
          </>
        )}

        {/* Action Node */}
        {node.type === 'action' && (
          <>
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select
                value={(node.data.actionType as string) || 'tag'}
                onValueChange={(value) => handleChange('actionType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tag">Add Tag</SelectItem>
                  <SelectItem value="remove_tag">Remove Tag</SelectItem>
                  <SelectItem value="set_variable">Set Variable</SelectItem>
                  <SelectItem value="assign_agent">Assign to Agent</SelectItem>
                  <SelectItem value="update_stage">Update Contact Stage</SelectItem>
                  <SelectItem value="create_deal">Create Deal</SelectItem>
                  <SelectItem value="webhook">Call Webhook</SelectItem>
                  <SelectItem value="handoff">Human Handoff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action-specific fields */}
            {((node.data.actionType as string) === 'tag' ||
              (node.data.actionType as string) === 'remove_tag') && (
                <div className="space-y-2">
                  <Label htmlFor="tagName">Tag Name</Label>
                  <Input
                    id="tagName"
                    value={(node.data.tagName as string) || ''}
                    onChange={(e) => handleChange('tagName', e.target.value)}
                    placeholder="e.g., interested"
                  />
                </div>
              )}

            {(node.data.actionType as string) === 'set_variable' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="variableName">Variable Name</Label>
                  <Input
                    id="variableName"
                    value={(node.data.variableName as string) || ''}
                    onChange={(e) => handleChange('variableName', e.target.value)}
                    placeholder="e.g., user_preference"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variableValue">Value</Label>
                  <Input
                    id="variableValue"
                    value={(node.data.variableValue as string) || ''}
                    onChange={(e) => handleChange('variableValue', e.target.value)}
                    placeholder="Value to set"
                  />
                </div>
              </>
            )}

            {(node.data.actionType as string) === 'update_stage' && (
              <div className="space-y-2">
                <Label>New Stage</Label>
                <Select
                  value={(node.data.stage as string) || 'LEAD'}
                  onValueChange={(value) => handleChange('stage', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="QUALIFIED">Qualified</SelectItem>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                    <SelectItem value="CHURNED">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(node.data.actionType as string) === 'webhook' && (
              <div className="space-y-2">
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  value={(node.data.webhookUrl as string) || ''}
                  onChange={(e) => handleChange('webhookUrl', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}

            {(node.data.actionType as string) === 'create_deal' && (
              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label htmlFor="pipelineId">Pipeline ID</Label>
                  <Input
                    id="pipelineId"
                    value={(node.data.pipelineId as string) || ''}
                    onChange={(e) => handleChange('pipelineId', e.target.value)}
                    placeholder="Pipeline UUID"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stageId">Stage ID</Label>
                  <Input
                    id="stageId"
                    value={(node.data.stageId as string) || ''}
                    onChange={(e) => handleChange('stageId', e.target.value)}
                    placeholder="Stage ID (e.g. lead-new)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dealTitle">Deal Title</Label>
                  <Input
                    id="dealTitle"
                    value={(node.data.dealTitle as string) || ''}
                    onChange={(e) => handleChange('dealTitle', e.target.value)}
                    placeholder="e.g. Deal for {{name}}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Supports {'{{variables}}'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dealValue">Value</Label>
                  <Input
                    id="dealValue"
                    type="number"
                    value={(node.data.dealValue as string) || ''}
                    onChange={(e) => handleChange('dealValue', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* Delay Node */}
        {node.type === 'delay' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={(node.data.duration as number) || 1}
                onChange={(e) => handleChange('duration', parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={(node.data.unit as string) || 'minutes'}
                onValueChange={(value) => handleChange('unit', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Seconds</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* AI Node */}
        {node.type === 'ai' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="prompt">AI Prompt</Label>
              <Textarea
                id="prompt"
                value={(node.data.prompt as string) || ''}
                onChange={(e) => handleChange('prompt', e.target.value)}
                placeholder="Enter the prompt for AI response..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{variable}}'} to include flow variables
              </p>
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={(node.data.provider as string) || 'openai'}
                onValueChange={(value) => handleChange('provider', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select
                value={(node.data.model as string) || 'gpt-4o-mini'}
                onValueChange={(value) => handleChange('model', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(node.data.provider as string) === 'anthropic' ? (
                    <>
                      <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                      <SelectItem value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="saveToVariable">Save Response to Variable</Label>
              <Input
                id="saveToVariable"
                value={(node.data.saveToVariable as string) || ''}
                onChange={(e) => handleChange('saveToVariable', e.target.value)}
                placeholder="e.g., ai_response"
              />
            </div>
          </>
        )}

        {/* Media Node */}
        {node.type === 'media' && (
          <>
            <div className="space-y-2">
              <Label>Media Type</Label>
              <Select
                value={(node.data.mediaType as string) || 'image'}
                onValueChange={(value) => handleChange('mediaType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="audio">Audio</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Media URL</Label>
              <Input
                id="url"
                value={(node.data.url as string) || ''}
                onChange={(e) => handleChange('url', e.target.value)}
                placeholder="https://example.com/media.jpg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="caption">Caption (optional)</Label>
              <Textarea
                id="caption"
                value={(node.data.caption as string) || ''}
                onChange={(e) => handleChange('caption', e.target.value)}
                placeholder="Enter a caption for the media..."
                rows={2}
              />
            </div>
            {(node.data.mediaType as string) === 'document' && (
              <div className="space-y-2">
                <Label htmlFor="filename">Filename</Label>
                <Input
                  id="filename"
                  value={(node.data.filename as string) || ''}
                  onChange={(e) => handleChange('filename', e.target.value)}
                  placeholder="document.pdf"
                />
              </div>
            )}
          </>
        )}

        {/* Template Node */}
        {node.type === 'template' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="templateId">Template ID</Label>
              <Input
                id="templateId"
                value={(node.data.templateId as string) || ''}
                onChange={(e) => handleChange('templateId', e.target.value)}
                placeholder="Enter template ID"
              />
              <p className="text-xs text-muted-foreground">
                The WhatsApp template ID from Meta Business
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name</Label>
              <Input
                id="templateName"
                value={(node.data.templateName as string) || ''}
                onChange={(e) => handleChange('templateName', e.target.value)}
                placeholder="e.g., welcome_message"
              />
            </div>
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={(node.data.language as string) || 'en'}
                onValueChange={(value) => handleChange('language', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="pt_BR">Portuguese (BR)</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Template Parameters</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Add parameters as JSON (e.g., {`{"1": "value"}`})
              </p>
              <Textarea
                value={(node.data.paramsJson as string) || ''}
                onChange={(e) => handleChange('paramsJson', e.target.value)}
                placeholder='{"1": "{{contact_name}}", "2": "{{order_id}}"}'
                rows={3}
              />
            </div>
          </>
        )}

        {/* Start Node - Not editable */}
        {node.type === 'start' && (
          <div className="text-sm text-muted-foreground">
            <p>This is the entry point of your flow.</p>
            <p className="mt-2">
              Connect this node to the first action you want to trigger when a
              conversation starts.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
