export type EventType =
    | 'FLOW_COMPLETED'
    | 'DEAL_STAGE_CHANGED'
    | 'CONTACT_TAG_ADDED'
    | 'CONTACT_CREATED'

export interface AutomationEvent {
    id: string
    type: EventType
    organizationId: string
    timestamp: number
    data: Record<string, any>
}

// Event Data Payloads
export interface FlowCompletedEvent extends AutomationEvent {
    type: 'FLOW_COMPLETED'
    data: {
        flowId: string
        contactId: string
        variables: Record<string, any>
    }
}

export interface DealStageChangedEvent extends AutomationEvent {
    type: 'DEAL_STAGE_CHANGED'
    data: {
        dealId: string
        contactId: string
        oldStageId: string
        newStageId: string
        pipelineId: string
    }
}

export interface ContactTagAddedEvent extends AutomationEvent {
    type: 'CONTACT_TAG_ADDED'
    data: {
        contactId: string
        tag: string
    }
}

// Action Types
export type ActionType =
    | 'SEND_MESSAGE'
    | 'ADD_TAG'
    | 'START_SEQUENCE'
    | 'CREATE_DEAL'
    | 'UPDATE_DEAL_STAGE'

export interface AutomationAction {
    id: string
    type: ActionType
    config: Record<string, any>
}
